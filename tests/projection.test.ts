import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/events";
import { getActiveLink, regenerateLink } from "@/lib/links";
import { moderate } from "@/lib/moderation";
import { ForbiddenError } from "@/lib/permissions";
import { getScreenState, updateProjectionSettings } from "@/lib/projection";
import { redis } from "@/lib/redis";
import { keys } from "@/lib/storage";
import { makeUser, sampleEvent } from "./helpers";

afterAll(() => redis().disconnect());

async function seed() {
  const owner = await makeUser();
  const event = await createEvent(owner, sampleEvent);
  const mk = (status: "pending" | "approved", type: "photo" | "video" = "photo") =>
    db.media.create({
      data: {
        eventId: event.id, type, status, senderName: "Tía Marta", originalKey: "x", approvedAt: status === "approved" ? new Date() : null,
        displayKey: keys.display(event.id, `m${Math.random()}`, type === "photo" ? "webp" : "mp4"),
        posterKey: type === "video" ? "p" : null, durationMs: type === "video" ? 12000 : null,
      },
    });
  const approved = await mk("approved");
  const video = await mk("approved", "video");
  const pending = await mk("pending");
  const screen = (await getActiveLink(event.id, "screen"))!;
  return { owner, event, approved, video, pending, token: screen.token };
}

describe("pantalla de proyección", () => {
  it("apagada no entrega contenido, solo la pantalla de espera", async () => {
    const { token } = await seed();
    const state = await getScreenState(token);
    expect(state).toMatchObject({ on: false, reason: "off", items: [] });
    expect(state.appearance.waitingText.text).toBe("Subí tu foto o video");
    expect(state.uploadUrl).toMatch(/\/e\//);
  });

  it("encendida muestra solo lo aprobado, con enlaces firmados", async () => {
    const { owner, event, approved, video, token } = await seed();
    await updateProjectionSettings(owner, event.id, { enabled: true });
    const state = await getScreenState(token);
    expect(state.on).toBe(true);
    expect(state.items.map((i) => i.id).sort()).toEqual([approved.id, video.id].sort());
    expect(state.items.find((i) => i.id === video.id)).toMatchObject({ type: "video", durationMs: 12000 });
    expect(state.items[0].url).toMatch(/sig=/);
  });

  it("al rechazar algo aprobado desaparece de la pantalla", async () => {
    const { owner, event, approved, token } = await seed();
    await updateProjectionSettings(owner, event.id, { enabled: true });
    await moderate(owner, event.id, [approved.id], "reject");
    expect((await getScreenState(token)).items.some((i) => i.id === approved.id)).toBe(false);
  });

  it("vencida se comporta como apagada", async () => {
    const { owner, event, token } = await seed();
    await updateProjectionSettings(owner, event.id, { enabled: true, expiresAt: new Date(Date.now() - 60_000) });
    expect(await getScreenState(token)).toMatchObject({ on: false, reason: "expired", items: [] });
  });

  it("guarda tiempos y comportamiento de videos y sube la versión", async () => {
    const { owner, event, token } = await seed();
    const before = (await getScreenState(token)).settings.version;
    await updateProjectionSettings(owner, event.id, { photoSeconds: 12, videoMode: "capped", videoMaxSeconds: 20, playOrder: "random", showSenderName: false });
    const s = (await getScreenState(token)).settings;
    expect(s).toMatchObject({ photoSeconds: 12, videoMode: "capped", videoMaxSeconds: 20, playOrder: "random", showSenderName: false });
    expect(s.version).toBe(before + 1);
  });

  it("el link de invitados no abre la pantalla, y el de pantalla se puede regenerar", async () => {
    const { owner, event, token } = await seed();
    const upload = (await getActiveLink(event.id, "upload"))!;
    await expect(getScreenState(upload.token)).rejects.toMatchObject({ reason: "not_found" });
    await regenerateLink(owner, event.id, "screen");
    await expect(getScreenState(token)).rejects.toMatchObject({ reason: "revoked" });
  });

  it("un moderador no puede cambiar la configuración de la pantalla", async () => {
    const { event } = await seed();
    const mod = await makeUser();
    await db.eventMember.create({ data: { eventId: event.id, userId: mod.id, role: "moderator" } });
    await expect(updateProjectionSettings(mod, event.id, { enabled: true })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
