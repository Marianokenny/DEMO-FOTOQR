import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/events";
import { beatPhotoMs, featuresSchema, readFeatures } from "@/lib/features";
import { getActiveLink } from "@/lib/links";
import { controlScreen, getLive, leaderboard, reportNowPlaying, saveFeatures, selfieIfDue, selfieMosaic } from "@/lib/live";
import { ForbiddenError } from "@/lib/permissions";
import { buildScreenState } from "@/lib/projection";
import { guestChannel } from "@/lib/realtime";
import { newRedisConnection, redis } from "@/lib/redis";
import { createUploads, uploadRequestSchema } from "@/lib/uploads";
import { makeUser, sampleEvent } from "./helpers";

afterAll(() => redis().disconnect());

async function seed() {
  const owner = await makeUser();
  const event = await createEvent(owner, sampleEvent);
  const guest = async (name: string | null) =>
    db.guestSession.create({ data: { eventId: event.id, tokenHash: `h-${Math.random()}`, name, ipHash: "x", userAgent: "t" } });
  const mk = (guestSessionId: string | null, status: "approved" | "pending" = "approved", createdAt = new Date()) =>
    db.media.create({ data: { eventId: event.id, guestSessionId, type: "photo", status, originalKey: "o", displayKey: "d", thumbKey: "t", approvedAt: new Date(), createdAt } });
  const screen = (await getActiveLink(event.id, "screen"))!;
  return { owner, event, guest, mk, screenToken: screen.token };
}

describe("funciones en vivo", () => {
  it("configuración con valores por defecto y validada", async () => {
    const f = readFeatures({});
    expect(f.qrBreak).toMatchObject({ enabled: true, every: 8, text: "¡Subí tu foto!" });
    expect(beatPhotoMs({ enabled: true, bpm: 120, beatsPerPhoto: 4 })).toBe(2000);
    expect(featuresSchema.safeParse({ beat: { bpm: 400 } }).success).toBe(false);
    expect(featuresSchema.safeParse({ selfie: { at: "25:00" } }).success).toBe(false);
    const { owner, event } = await seed();
    await saveFeatures(owner, event.id, { ...f, beat: { enabled: true, bpm: 128, beatsPerPhoto: 2 } });
    expect((await buildScreenState(event.id)).features.beat).toEqual({ enabled: true, bpm: 128, beatsPerPhoto: 2 });
  });

  it("el saludo del invitado se guarda con la foto, limpio y con límite", async () => {
    expect(uploadRequestSchema.parse({ message: "  hola   Sofi  ", files: [{ name: "a.jpg", size: 1, type: "image/jpeg" }] }).message).toBe("hola Sofi");
    expect(uploadRequestSchema.safeParse({ message: "x".repeat(141), files: [{ name: "a.jpg", size: 1, type: "image/jpeg" }] }).success).toBe(false);
    const { event } = await seed();
    const upload = (await getActiveLink(event.id, "upload"))!;
    const r = await createUploads({ token: upload.token, ip: "1.1.1.1", userAgent: "t", request: { name: "Tía Marta", message: "¡Felices 15!", files: [{ name: "a.jpg", size: 1000, type: "image/jpeg" }] } });
    expect((await db.media.findUniqueOrThrow({ where: { id: r.uploads[0].mediaId } })).message).toBe("¡Felices 15!");
  });

  it("control en vivo: fijar, pausar y solo para quien modera", async () => {
    const { owner, event, mk } = await seed();
    const m = await mk(null);
    const pending = await mk(null, "pending");
    expect(await controlScreen(owner, event.id, { kind: "pin", mediaId: m.id })).toMatchObject({ pinnedId: m.id });
    await expect(controlScreen(owner, event.id, { kind: "playNow", mediaId: pending.id })).rejects.toThrow(/aprobado/);
    expect(await controlScreen(owner, event.id, { kind: "pause" })).toMatchObject({ paused: true });
    await controlScreen(owner, event.id, { kind: "unpin" });
    expect(await getLive(event.id)).toMatchObject({ paused: true, pinnedId: null });
    const stranger = await makeUser();
    await expect(controlScreen(stranger, event.id, { kind: "skip" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("robot: marcar una foto llega a la pantalla, y solo en fotos aprobadas", async () => {
    const f = readFeatures({});
    expect(f.robot).toMatchObject({ enabled: true, every: 6, text: "" });
    expect(featuresSchema.safeParse({ robot: { moves: [] } }).success).toBe(false);
    expect(featuresSchema.safeParse({ robot: { moves: ["fly"] } }).success).toBe(false);
    const { owner, event, mk } = await seed();
    const m = await mk(null);
    const pending = await mk(null, "pending");
    await db.projectionSettings.update({ where: { eventId: event.id }, data: { enabled: true } });
    await controlScreen(owner, event.id, { kind: "robot", mediaId: m.id, move: "dance" });
    expect((await buildScreenState(event.id)).items.find((i) => i.id === m.id)?.robot).toBe("dance");
    await expect(controlScreen(owner, event.id, { kind: "robot", mediaId: pending.id, move: "wave" })).rejects.toThrow(/aprobadas/);
    await controlScreen(owner, event.id, { kind: "robot", mediaId: m.id, move: null });
    expect((await db.media.findUniqueOrThrow({ where: { id: m.id } })).robotMove).toBeNull();
    await controlScreen(owner, event.id, { kind: "robot", move: "random" }); // robot now, no photo
    await saveFeatures(owner, event.id, { robot: { ...f.robot, moves: ["photo", "love"], every: 3 } });
    expect((await buildScreenState(event.id)).features.robot).toMatchObject({ moves: ["photo", "love"], every: 3 });
    const stranger = await makeUser();
    await expect(controlScreen(stranger, event.id, { kind: "robot", move: "wave" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("ranking: top por fotos aprobadas, sin anónimos", async () => {
    const { event, guest, mk } = await seed();
    const ana = await guest("Ana"), juan = await guest("Juan"), anon = await guest(null);
    for (let i = 0; i < 3; i++) await mk(ana.id);
    await mk(juan.id);
    await mk(juan.id, "pending");
    for (let i = 0; i < 5; i++) await mk(anon.id);
    expect((await leaderboard(event.id)).map((r) => [r.name, r.count])).toEqual([["Ana", 3], ["Juan", 1]]);
  });

  it("avisa al invitado una sola vez cuando su foto está por salir y cuando sale", async () => {
    const { event, guest, mk, screenToken } = await seed();
    const g = await guest("Ana");
    const a = await mk(g.id), b = await mk(g.id);
    const sub = newRedisConnection();
    const got: string[] = [];
    sub.on("message", (_c, m) => got.push(JSON.parse(m).type));
    await sub.subscribe(guestChannel(g.id));
    await reportNowPlaying(screenToken, a.id, b.id);
    await reportNowPlaying(screenToken, a.id, b.id); // repeated report: no duplicate
    await reportNowPlaying(screenToken, b.id, null);
    await new Promise((r) => setTimeout(r, 200));
    sub.disconnect();
    expect(got.sort()).toEqual(["onscreen", "onscreen", "upcoming"]);
    expect(await getLive(event.id)).toMatchObject({ nowId: b.id, nextId: null });
  });

  it("selfie sorpresa: arranca a la hora, una sola vez, y el mosaico trae lo que llegó después", async () => {
    const { owner, event, mk, screenToken } = await seed();
    await saveFeatures(owner, event.id, { ...readFeatures({}), selfie: { at: "22:30", collectSeconds: 60, text: "¡Selfie!" } });
    const at = (hhmm: string) => new Date(`2026-12-12T${hhmm}:00-03:00`);
    expect(await selfieIfDue(screenToken, at("22:29"))).toBe(false);
    await mk(null, "approved", new Date(Date.now() - 60_000)); // before the selfie: not in the mosaic
    expect(await selfieIfDue(screenToken, at("22:31"))).toBe(true);
    expect(await selfieIfDue(screenToken, at("22:32"))).toBe(false);
    const after = await mk(null);
    expect((await selfieMosaic(screenToken)).map((x) => x.id)).toEqual([after.id]);
    expect((await getLive(event.id)).selfie).not.toBeNull();
  });
});
