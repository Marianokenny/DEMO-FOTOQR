import type { MediaStatus, MediaType, Prisma, User } from "@prisma/client";
import { db } from "./db";
import { assertCan } from "./permissions";
import { publish } from "./realtime";
import { keys, storage } from "./storage";

export type ModerationAction = "approve" | "reject" | "delete";
export type StatusFilter = "pending" | "approved" | "rejected" | "all";
const VISIBLE: MediaStatus[] = ["processing", "pending", "approved", "rejected"];
const PAGE = 60;

type Actor = Pick<User, "id" | "role">;

/** Media as the panel sees it, with short-lived URLs for thumbnails and the full view. */
export type MediaItem = {
  id: string; type: MediaType; status: MediaStatus; senderName: string | null; message: string | null; createdAt: string;
  width: number | null; height: number | null; durationMs: number | null;
  thumbUrl: string | null; displayUrl: string | null; posterUrl: string | null;
};

async function sign(key: string | null, ttl = 3600) {
  return key ? storage().presignDownload(key, ttl) : null;
}

export async function toItem(m: Prisma.MediaGetPayload<object>): Promise<MediaItem> {
  return {
    id: m.id, type: m.type, status: m.status, senderName: m.senderName, message: m.message, createdAt: m.createdAt.toISOString(),
    width: m.width, height: m.height, durationMs: m.durationMs,
    thumbUrl: await sign(m.thumbKey), displayUrl: await sign(m.displayKey), posterUrl: await sign(m.posterKey),
  };
}

export async function listMedia(user: Actor, eventId: string, opts: { status?: StatusFilter; type?: MediaType | "all"; cursor?: string } = {}) {
  await assertCan(user, eventId, "view");
  const status = opts.status ?? "pending";
  const where: Prisma.MediaWhereInput = {
    eventId,
    status: status === "all" ? { in: VISIBLE } : status === "pending" ? { in: ["pending", "processing"] } : status,
    ...(opts.type && opts.type !== "all" ? { type: opts.type } : {}),
  };
  const rows = await db.media.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const counts = await db.media.groupBy({ by: ["status"], where: { eventId, status: { in: VISIBLE } }, _count: { _all: true } });
  const c = (s: MediaStatus) => counts.find((x) => x.status === s)?._count._all ?? 0;
  return {
    items: await Promise.all(rows.slice(0, PAGE).map(toItem)),
    nextCursor: rows.length > PAGE ? rows[PAGE - 1].id : null,
    counts: { pending: c("pending") + c("processing"), approved: c("approved"), rejected: c("rejected"), all: counts.reduce((a, x) => a + x._count._all, 0) },
  };
}

/** Applies one action to several items of the same event. Ids from other events are ignored. */
export async function moderate(user: Actor, eventId: string, ids: string[], action: ModerationAction) {
  await assertCan(user, eventId, "moderate");
  const unique = [...new Set(ids)].slice(0, 500);
  const targets = await db.media.findMany({ where: { id: { in: unique }, eventId, status: { in: VISIBLE } } });
  const now = new Date();

  if (action === "delete") {
    await db.media.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { status: "deleted", moderatedById: user.id, moderatedAt: now } });
    await Promise.all(targets.map((t) => storage().deletePrefix(keys.mediaPrefix(eventId, t.id))));
    await Promise.all(targets.map((t) => publish(eventId, { type: "media.removed", mediaId: t.id })));
    return { count: targets.length };
  }

  // Items still processing can't be approved yet; they'd show up broken on the screen.
  const ready = targets.filter((t) => t.status !== "processing");
  const status: MediaStatus = action === "approve" ? "approved" : "rejected";
  await db.media.updateMany({
    where: { id: { in: ready.map((t) => t.id) } },
    data: { status, moderatedById: user.id, moderatedAt: now, approvedAt: action === "approve" ? now : null },
  });
  await Promise.all(ready.map((t) =>
    publish(eventId, t.status === "approved" && action === "reject" ? { type: "media.removed", mediaId: t.id } : { type: "media.updated", mediaId: t.id, status }),
  ));
  return { count: ready.length };
}

export async function approveAllPending(user: Actor, eventId: string) {
  await assertCan(user, eventId, "moderate");
  const pending = await db.media.findMany({ where: { eventId, status: "pending" }, select: { id: true } });
  return moderate(user, eventId, pending.map((p) => p.id), "approve");
}

export async function setAutoApprove(user: Actor, eventId: string, enabled: boolean) {
  await assertCan(user, eventId, "configure");
  await db.projectionSettings.update({ where: { eventId }, data: { autoApprove: enabled, version: { increment: 1 } } });
  await publish(eventId, { type: "settings.updated" });
}
