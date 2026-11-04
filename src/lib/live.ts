import type { User } from "@prisma/client";
import { APP_UTC_OFFSET } from "./dates";
import { db } from "./db";
import { readFeatures, featuresSchema, type Features } from "./features";
import { resolveLink } from "./links";
import { assertCan } from "./permissions";
import { publish, publishToGuest, type ScreenCommand } from "./realtime";
import { redis } from "./redis";
import { storage } from "./storage";

type Actor = Pick<User, "id" | "role">;

/** What the organizer controls live. Kept in Redis: it only matters while the party is on. */
export type LiveState = {
  paused: boolean;
  pinnedId: string | null;
  nowId: string | null;
  nextId: string | null;
  selfie: { startedAt: string; endsAt: string } | null;
};

const EMPTY: LiveState = { paused: false, pinnedId: null, nowId: null, nextId: null, selfie: null };
const TTL = 3 * 24 * 3600;
const key = (eventId: string) => `live:${eventId}`;

export class LiveError extends Error {}

export async function getLive(eventId: string): Promise<LiveState> {
  const raw = await redis().get(key(eventId));
  return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
}

async function patchLive(eventId: string, patch: Partial<LiveState>) {
  const next = { ...(await getLive(eventId)), ...patch };
  await redis().set(key(eventId), JSON.stringify(next), "EX", TTL);
  return next;
}

async function announce(eventId: string, s: LiveState) {
  await publish(eventId, { type: "screen.now", nowId: s.nowId, nextId: s.nextId, paused: s.paused, pinnedId: s.pinnedId });
}

/** Top guests by approved photos and videos. Guests without a name are left out. */
export async function leaderboard(eventId: string, take = 5) {
  const rows = await db.media.groupBy({
    by: ["guestSessionId"],
    where: { eventId, status: "approved", guestSessionId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { guestSessionId: "desc" } },
    take: take * 3,
  });
  const guests = await db.guestSession.findMany({ where: { id: { in: rows.map((r) => r.guestSessionId!) } } });
  return rows
    .map((r) => ({ guestId: r.guestSessionId!, name: guests.find((g) => g.id === r.guestSessionId)?.name?.trim() ?? "", count: r._count._all }))
    .filter((r) => r.name)
    .slice(0, take);
}

async function winnerOf(eventId: string) {
  const [top] = await leaderboard(eventId, 1);
  if (!top) return null;
  const last = await db.media.findFirst({
    where: { eventId, guestSessionId: top.guestId, status: "approved", type: "photo", displayKey: { not: null } },
    orderBy: { approvedAt: "desc" },
  });
  return { name: top.name, count: top.count, thumbUrl: last?.displayKey ? await storage().presignDownload(last.displayKey, 3600) : null };
}

async function startSelfie(eventId: string, features: Features) {
  const now = Date.now();
  const s = await patchLive(eventId, { selfie: { startedAt: new Date(now).toISOString(), endsAt: new Date(now + features.selfie.collectSeconds * 1000).toISOString() } });
  await publish(eventId, { type: "control", command: { kind: "selfie", startedAt: s.selfie!.startedAt, endsAt: s.selfie!.endsAt, text: features.selfie.text } });
}

export type ControlInput =
  | { kind: "playNow" | "pin"; mediaId: string }
  | { kind: "unpin" | "skip" | "pause" | "resume" | "qr" | "leaderboard" | "winner" | "selfie" };

/** Commands from the organizer's phone to the screen. */
export async function controlScreen(user: Actor, eventId: string, input: ControlInput) {
  await assertCan(user, eventId, "moderate");
  let command: ScreenCommand;
  switch (input.kind) {
    case "playNow":
    case "pin": {
      const m = await db.media.findFirst({ where: { id: input.mediaId, eventId, status: "approved" } });
      if (!m) throw new LiveError("Ese archivo no está aprobado.");
      if (input.kind === "pin") await patchLive(eventId, { pinnedId: m.id });
      command = { kind: input.kind, mediaId: m.id };
      break;
    }
    case "unpin":
      await patchLive(eventId, { pinnedId: null });
      command = { kind: "unpin" };
      break;
    case "pause":
    case "resume":
      await patchLive(eventId, { paused: input.kind === "pause" });
      command = { kind: input.kind };
      break;
    case "winner":
      command = { kind: "winner", winner: await winnerOf(eventId) };
      break;
    case "selfie": {
      const s = await db.projectionSettings.findUniqueOrThrow({ where: { eventId } });
      await startSelfie(eventId, readFeatures(s.features));
      return getLive(eventId);
    }
    default:
      command = { kind: input.kind };
  }
  await publish(eventId, { type: "control", command });
  const state = await getLive(eventId);
  await announce(eventId, state);
  return state;
}

/**
 * The screen tells what it is showing and what comes next. Guests whose photo is next get a
 * heads-up on their phone, and another one when it is on screen.
 */
export async function reportNowPlaying(token: string, nowId: string | null, nextId: string | null) {
  const link = await resolveLink(token, "screen");
  const eventId = link.eventId;
  const prev = await getLive(eventId);
  const state = await patchLive(eventId, { nowId, nextId });
  if (prev.nowId !== nowId || prev.nextId !== nextId) await announce(eventId, state);

  const notify = async (id: string | null, type: "upcoming" | "onscreen") => {
    if (!id) return;
    // Once per photo and kind, even if the screen reports twice.
    if (!(await redis().set(`notified:${type}:${id}`, "1", "EX", 6 * 3600, "NX"))) return;
    const m = await db.media.findFirst({ where: { id, eventId }, select: { guestSessionId: true, thumbKey: true } });
    if (!m?.guestSessionId) return;
    await publishToGuest(m.guestSessionId, { type, mediaId: id, thumbUrl: m.thumbKey ? await storage().presignDownload(m.thumbKey, 3600) : null });
  };
  if (nextId && nextId !== nowId) await notify(nextId, "upcoming");
  await notify(nowId, "onscreen");
  return state;
}

/** Called by the screen every minute: starts the surprise selfie at the configured time, once a day. */
export async function selfieIfDue(token: string, now = new Date()) {
  const link = await resolveLink(token, "screen");
  const s = await db.projectionSettings.findUniqueOrThrow({ where: { eventId: link.eventId } });
  const f = readFeatures(s.features);
  if (!f.selfie.at) return false;
  const local = new Date(now.getTime() + Number(APP_UTC_OFFSET.slice(0, 3)) * 3600_000);
  const hhmm = local.toISOString().slice(11, 16);
  if (hhmm < f.selfie.at) return false;
  // Only within 10 minutes after the time, so a screen opened late at night doesn't fire it.
  const [h, m] = f.selfie.at.split(":").map(Number);
  const minutesLate = local.getUTCHours() * 60 + local.getUTCMinutes() - (h * 60 + m);
  if (minutesLate > 10) return false;
  const day = local.toISOString().slice(0, 10);
  if (!(await redis().set(`selfie-fired:${link.eventId}:${day}:${f.selfie.at}`, "1", "EX", 2 * 24 * 3600, "NX"))) return false;
  await startSelfie(link.eventId, f);
  return true;
}

/** Photos that arrived during the selfie moment, for the mosaic. */
export async function selfieMosaic(token: string) {
  const link = await resolveLink(token, "screen");
  const live = await getLive(link.eventId);
  if (!live.selfie) return [];
  const media = await db.media.findMany({
    where: { eventId: link.eventId, type: "photo", status: "approved", createdAt: { gte: new Date(live.selfie.startedAt) }, thumbKey: { not: null } },
    orderBy: { createdAt: "asc" },
    take: 36,
  });
  return Promise.all(media.map(async (m) => ({ id: m.id, url: await storage().presignDownload(m.displayKey ?? m.thumbKey!, 3600), senderName: m.senderName })));
}

export async function saveFeatures(user: Actor, eventId: string, raw: unknown) {
  await assertCan(user, eventId, "configure");
  // Sections not sent keep their current value, so the live control can change only the beat.
  const current = readFeatures((await db.projectionSettings.findUniqueOrThrow({ where: { eventId } })).features);
  const parsed = featuresSchema.safeParse(raw && typeof raw === "object" ? { ...current, ...raw } : raw);
  if (!parsed.success) throw new LiveError("Configuración inválida.");
  await db.projectionSettings.update({ where: { eventId }, data: { features: parsed.data, version: { increment: 1 } } });
  await publish(eventId, { type: "settings.updated" });
  return parsed.data;
}
