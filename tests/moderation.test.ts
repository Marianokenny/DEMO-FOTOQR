import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/events";
import { listMedia, moderate, setAutoApprove, approveAllPending } from "@/lib/moderation";
import { ForbiddenError } from "@/lib/permissions";
import { eventChannel } from "@/lib/realtime";
import { newRedisConnection, redis } from "@/lib/redis";
import { keys, localStorageDriver, storage } from "@/lib/storage";
import { makeUser, sampleEvent } from "./helpers";

afterAll(() => redis().disconnect());

async function seed(statuses: ("pending" | "approved" | "rejected" | "processing")[]) {
  const owner = await makeUser();
  const event = await createEvent(owner, sampleEvent);
  const media = [];
  for (const [i, status] of statuses.entries()) {
    const m = await db.media.create({
      data: { eventId: event.id, type: i % 2 ? "video" : "photo", status, senderName: `Invitado ${i}`, originalKey: "x", thumbKey: keys.thumb(event.id, `m${i}`) },
    });
    await storage().put(keys.thumb(event.id, m.id), Buffer.from("x"), "image/webp");
    media.push(m);
  }
  return { owner, event, media };
}

describe("moderación", () => {
  it("lista por estado y tipo con contadores", async () => {
    const { owner, event } = await seed(["pending", "pending", "approved", "rejected", "processing"]);
    const pending = await listMedia(owner, event.id, { status: "pending" });
    expect(pending.items).toHaveLength(3); // processing counts as pending
    expect(pending.counts).toEqual({ pending: 3, approved: 1, rejected: 1, all: 5 });
    const videos = await listMedia(owner, event.id, { status: "all", type: "video" });
    expect(videos.items.every((i) => i.type === "video")).toBe(true);
    expect(pending.items[0].senderName).toMatch(/Invitado/);
  });

  it("aprobar y rechazar registran quién y cuándo", async () => {
    const { owner, event, media } = await seed(["pending", "pending"]);
    await moderate(owner, event.id, [media[0].id], "approve");
    await moderate(owner, event.id, [media[1].id], "reject");
    const [a, r] = await Promise.all(media.map((m) => db.media.findUniqueOrThrow({ where: { id: m.id } })));
    expect(a).toMatchObject({ status: "approved", moderatedById: owner.id });
    expect(a.approvedAt).not.toBeNull();
    expect(r).toMatchObject({ status: "rejected", approvedAt: null });
  });

  it("no aprueba algo que todavía se está procesando", async () => {
    const { owner, event, media } = await seed(["processing"]);
    expect(await moderate(owner, event.id, [media[0].id], "approve")).toEqual({ count: 0 });
  });

  it("eliminar borra también los archivos", async () => {
    const { owner, event, media } = await seed(["approved"]);
    const thumb = keys.thumb(event.id, media[0].id);
    expect(await localStorageDriver().size(thumb)).toBe(1);
    await moderate(owner, event.id, [media[0].id], "delete");
    expect((await db.media.findUniqueOrThrow({ where: { id: media[0].id } })).status).toBe("deleted");
    expect(await localStorageDriver().size(thumb)).toBeNull();
  });

  it("las acciones en lote no tocan contenido de otro evento", async () => {
    const a = await seed(["pending"]);
    const b = await seed(["pending"]);
    const res = await moderate(a.owner, a.event.id, [a.media[0].id, b.media[0].id], "approve");
    expect(res.count).toBe(1);
    expect((await db.media.findUniqueOrThrow({ where: { id: b.media[0].id } })).status).toBe("pending");
  });

  it("un organizador ajeno no puede moderar; un moderador sí, pero no cambiar la aprobación automática", async () => {
    const { event, media } = await seed(["pending"]);
    const intruder = await makeUser();
    await expect(moderate(intruder, event.id, [media[0].id], "approve")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listMedia(intruder, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    const mod = await makeUser();
    await db.eventMember.create({ data: { eventId: event.id, userId: mod.id, role: "moderator" } });
    await expect(moderate(mod, event.id, [media[0].id], "approve")).resolves.toEqual({ count: 1 });
    await expect(setAutoApprove(mod, event.id, true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("aprobar todos los pendientes de una vez", async () => {
    const { owner, event } = await seed(["pending", "pending", "pending", "rejected"]);
    expect(await approveAllPending(owner, event.id)).toEqual({ count: 3 });
  });

  it("avisa en vivo al aprobar y al sacar de pantalla", async () => {
    const { owner, event, media } = await seed(["pending"]);
    const sub = newRedisConnection();
    const got: unknown[] = [];
    sub.on("message", (_c, m) => got.push(JSON.parse(m)));
    await sub.subscribe(eventChannel(event.id));
    await moderate(owner, event.id, [media[0].id], "approve");
    await moderate(owner, event.id, [media[0].id], "reject");
    await new Promise((r) => setTimeout(r, 200));
    sub.disconnect();
    expect(got).toEqual([
      { type: "media.updated", mediaId: media[0].id, status: "approved" },
      { type: "media.removed", mediaId: media[0].id },
    ]);
  });
});
