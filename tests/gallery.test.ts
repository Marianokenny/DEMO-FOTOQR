import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createEvent, updateEvent } from "@/lib/events";
import { buildGallery, downloadName, getGalleryForUser, getPublicGallery, purgeExpiredEvents, zipEntries } from "@/lib/gallery";
import { getActiveLink, LinkError } from "@/lib/links";
import { ForbiddenError } from "@/lib/permissions";
import { redis } from "@/lib/redis";
import { keys, storage } from "@/lib/storage";
import { zipResponse } from "@/lib/zip";
import { makeUser, sampleEvent } from "./helpers";

afterAll(() => redis().disconnect());

async function seed(eventInput = sampleEvent) {
  const owner = await makeUser();
  const event = await createEvent(owner, eventInput);
  const st = storage();
  const mk = async (status: "pending" | "approved" | "rejected", type: "photo" | "video", sender: string | null) => {
    const m = await db.media.create({ data: { eventId: event.id, type, status, senderName: sender, originalKey: "tmp" } });
    const ext = type === "photo" ? "jpg" : "mp4";
    const full = keys.full(event.id, m.id, ext);
    await st.put(full, Buffer.from(`${type}-${m.id}`), "application/octet-stream");
    await st.put(keys.thumb(event.id, m.id), Buffer.from("t"), "image/webp");
    return db.media.update({
      where: { id: m.id },
      data: { originalKey: full, displayKey: full, thumbKey: keys.thumb(event.id, m.id), width: 1200, height: 800 },
    });
  };
  const p1 = await mk("approved", "photo", "Tía Marta");
  const v1 = await mk("approved", "video", null);
  const p2 = await mk("approved", "photo", "José");
  await mk("pending", "photo", "Pendiente");
  await mk("rejected", "photo", "Rechazada");
  const galleryLink = (await getActiveLink(event.id, "gallery"))!;
  return { owner, event, p1, v1, p2, token: galleryLink.token };
}

describe("galería", () => {
  it("muestra solo lo aprobado, lo más nuevo primero, con conteos", async () => {
    const { event, p1, v1, p2 } = await seed();
    const g = await buildGallery(event.id);
    expect(g.items.map((i) => i.id)).toEqual([p2.id, v1.id, p1.id]);
    expect(g.counts).toEqual({ all: 3, photo: 2, video: 1 });
    expect(g.items[0].downloadUrl).toContain("dn=");
  });

  it("nombres de descarga legibles y numerados por llegada", () => {
    expect(downloadName("Los 15 de Sofi", 7, { type: "photo", senderName: "Tía Marta" })).toBe("los-15-de-sofi-0007-tia-marta.jpg");
    expect(downloadName("¡Boda!", 1, { type: "video", senderName: null })).toBe("boda-0001.mp4");
  });

  it("el link público funciona y otro organizador no puede verla desde el panel", async () => {
    const { event, token } = await seed();
    expect((await getPublicGallery(token)).counts.all).toBe(3);
    const stranger = await makeUser();
    await expect(getGalleryForUser(stranger, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPublicGallery("token-falso")).rejects.toBeInstanceOf(LinkError);
  });

  it("el link de la galería vence junto con el plazo de guardado", async () => {
    const { owner, event, token } = await seed();
    await updateEvent(owner, event.id, { ...sampleEvent, storageDays: 7 });
    const link = await db.accessLink.findUniqueOrThrow({ where: { token } });
    const ev = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(link.expiresAt?.getTime()).toBe(ev.storageUntil.getTime());
  });

  it("arma un ZIP real con los archivos aprobados, filtrable por tipo", async () => {
    const { event } = await seed();
    const all = await zipEntries(event.id);
    expect(all.entries.map((e) => e.name)).toEqual(["los-15-de-sofi-0001-tia-marta.jpg", "los-15-de-sofi-0002.mp4", "los-15-de-sofi-0003-jose.jpg"]);
    expect((await zipEntries(event.id, "video")).entries).toHaveLength(1);

    const res = zipResponse("x.zip", all.entries);
    const dir = await mkdtemp(path.join(tmpdir(), "zip-"));
    const file = path.join(dir, "x.zip");
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    const listing = execFileSync("unzip", ["-l", file]).toString();
    expect(listing).toContain("los-15-de-sofi-0003-jose.jpg");
    expect(listing).toMatch(/3 files/);
  });

  it("al vencer el plazo borra los archivos, cierra los links y apaga la pantalla", async () => {
    const past = { ...sampleEvent, date: new Date("2025-01-01T21:00:00Z"), storageDays: 7 };
    const { event, p1, token } = await seed(past);
    const keep = await seed(); // event still within its period
    const n = await purgeExpiredEvents();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await storage().size(p1.originalKey)).toBeNull();
    const ev = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(ev.filesDeletedAt).not.toBeNull();
    expect(await db.media.count({ where: { eventId: event.id, status: { not: "deleted" } } })).toBe(0);
    await expect(getPublicGallery(token)).rejects.toBeInstanceOf(LinkError);
    expect((await buildGallery(event.id)).items).toEqual([]);
    expect(await storage().size(keep.p1.originalKey)).not.toBeNull();
    expect(await purgeExpiredEvents()).toBe(0); // idempotent
  });
});
