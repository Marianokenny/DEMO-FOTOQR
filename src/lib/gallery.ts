import type { Media, MediaType, User } from "@prisma/client";
import { db } from "./db";
import { resolveLink } from "./links";
import { assertCan } from "./permissions";
import { publish } from "./realtime";
import { keys, storage } from "./storage";

const URL_TTL = 6 * 3600;
const MAX_ITEMS = 5000;

export type GalleryItem = {
  id: string;
  type: MediaType;
  thumbUrl: string;
  viewUrl: string;
  posterUrl: string | null;
  downloadUrl: string;
  senderName: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type Gallery = {
  event: { id: string; name: string; date: string; color: string; storageUntil: string; filesDeleted: boolean };
  items: GalleryItem[];
  counts: { all: number; photo: number; video: number };
};

/** Readable file name for downloads: "los-15-de-sofi-0007-tia-marta.jpg". */
export function downloadName(eventName: string, index: number, m: Pick<Media, "type" | "senderName">) {
  const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const who = m.senderName ? `-${slug(m.senderName)}` : "";
  return `${slug(eventName) || "evento"}-${String(index).padStart(4, "0")}${who}.${m.type === "video" ? "mp4" : "jpg"}`;
}

async function approvedMedia(eventId: string, type?: MediaType) {
  return db.media.findMany({
    where: { eventId, status: "approved", displayKey: { not: null }, ...(type ? { type } : {}) },
    orderBy: { createdAt: "asc" },
    take: MAX_ITEMS,
  });
}

export async function buildGallery(eventId: string): Promise<Gallery> {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  const media = event.filesDeletedAt ? [] : await approvedMedia(eventId);
  const st = storage();
  const items = await Promise.all(media.map(async (m, i): Promise<GalleryItem> => ({
    id: m.id,
    type: m.type,
    thumbUrl: await st.presignDownload(m.thumbKey ?? m.displayKey!, URL_TTL),
    viewUrl: await st.presignDownload(m.displayKey!, URL_TTL),
    posterUrl: m.posterKey ? await st.presignDownload(m.posterKey, URL_TTL) : null,
    downloadUrl: await st.presignDownload(m.originalKey, URL_TTL, downloadName(event.name, i + 1, m)),
    senderName: m.senderName,
    width: m.width,
    height: m.height,
    createdAt: m.createdAt.toISOString(),
  })));
  // Newest first on screen; numbering in file names follows arrival order.
  items.reverse();
  const photo = items.filter((x) => x.type === "photo").length;
  return {
    event: {
      id: event.id, name: event.name, date: event.date.toISOString(), color: event.brandColor,
      storageUntil: event.storageUntil.toISOString(), filesDeleted: !!event.filesDeletedAt,
    },
    items,
    counts: { all: items.length, photo, video: items.length - photo },
  };
}

export async function getGalleryForUser(user: Pick<User, "id" | "role">, eventId: string) {
  await assertCan(user, eventId, "view");
  return buildGallery(eventId);
}

/** Public gallery behind the share link. Expires together with the files. */
export async function getPublicGallery(token: string) {
  const link = await resolveLink(token, "gallery");
  return buildGallery(link.eventId);
}

/** Files to put in a ZIP, in arrival order, with readable names. */
export async function zipEntries(eventId: string, type?: MediaType) {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  if (event.filesDeletedAt) return { event, entries: [] };
  const all = await approvedMedia(eventId);
  const entries = all
    .map((m, i) => ({ m, name: downloadName(event.name, i + 1, m) }))
    .filter(({ m }) => !type || m.type === type)
    .map(({ m, name }) => ({ key: m.originalKey, name }));
  return { event, entries };
}

/**
 * Deletes every file of the events whose storage period is over. The event and its numbers stay, the
 * files do not. Runs from the worker on a schedule; safe to run again.
 */
export async function purgeExpiredEvents(now = new Date()) {
  const due = await db.event.findMany({ where: { storageUntil: { lt: now }, filesDeletedAt: null }, select: { id: true } });
  for (const { id } of due) {
    await storage().deletePrefix(keys.eventPrefix(id));
    await db.$transaction([
      db.media.updateMany({ where: { eventId: id, status: { not: "deleted" } }, data: { status: "deleted" } }),
      db.asset.deleteMany({ where: { eventId: id } }),
      db.accessLink.updateMany({ where: { eventId: id, revokedAt: null }, data: { revokedAt: now } }),
      db.projectionSettings.update({ where: { eventId: id }, data: { enabled: false, version: { increment: 1 } } }),
      db.event.update({ where: { id }, data: { filesDeletedAt: now, status: "archived" } }),
    ]);
    await publish(id, { type: "settings.updated" });
  }
  return due.length;
}
