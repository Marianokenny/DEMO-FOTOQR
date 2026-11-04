import type { LinkType, User } from "@prisma/client";
import { db } from "./db";
import { assertCan } from "./permissions";
import { randomToken } from "./tokens";
import type { EventInput, UploadSettingsInput } from "./validation";

const DAY = 24 * 60 * 60 * 1000;
const LINK_TYPES: LinkType[] = ["upload", "screen", "gallery"];

export function storageUntilFrom(date: Date, storageDays: number): Date {
  return new Date(date.getTime() + storageDays * DAY);
}

/** Creates an event with its owner membership, default settings and its three exclusive links. */
export async function createEvent(owner: Pick<User, "id">, input: EventInput) {
  const storageUntil = storageUntilFrom(input.date, input.storageDays);
  return db.event.create({
    data: {
      ownerId: owner.id,
      name: input.name,
      type: input.type,
      date: input.date,
      venue: input.venue,
      brandColor: input.brandColor,
      storageUntil,
      members: { create: { userId: owner.id, role: "owner" } },
      projectionSettings: {
        // By default the projection stays available until 12 hours after the event starts.
        create: { expiresAt: new Date(input.date.getTime() + 12 * 60 * 60 * 1000) },
      },
      uploadSettings: { create: {} },
      links: {
        create: LINK_TYPES.map((type) => ({
          type,
          token: randomToken(),
          // Upload and screen links expire with the projection window; the gallery with storage.
          expiresAt: type === "gallery" ? storageUntil : new Date(input.date.getTime() + 24 * 60 * 60 * 1000),
        })),
      },
    },
  });
}

export async function updateEvent(user: Pick<User, "id" | "role">, eventId: string, input: EventInput) {
  await assertCan(user, eventId, "configure");
  return db.event.update({
    where: { id: eventId },
    data: {
      name: input.name,
      type: input.type,
      date: input.date,
      venue: input.venue ?? null,
      brandColor: input.brandColor,
      storageUntil: storageUntilFrom(input.date, input.storageDays),
    },
  });
}

export async function deleteEvent(user: Pick<User, "id" | "role">, eventId: string) {
  await assertCan(user, eventId, "delete");
  await db.event.delete({ where: { id: eventId } });
}

/** Events the user can see: the ones they belong to, or all of them for a platform admin. */
export async function listEventsForUser(user: Pick<User, "id" | "role">) {
  return db.event.findMany({
    where: user.role === "admin" ? {} : { members: { some: { userId: user.id } } },
    orderBy: { date: "desc" },
    include: {
      projectionSettings: { select: { enabled: true, autoApprove: true, expiresAt: true } },
      _count: { select: { media: { where: { status: { notIn: ["deleted", "uploading", "failed"] } } } } },
    },
  });
}

export async function getEventForUser(user: Pick<User, "id" | "role">, eventId: string) {
  await assertCan(user, eventId, "view");
  return db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { projectionSettings: true, uploadSettings: true, links: { where: { revokedAt: null } } },
  });
}

export async function getEventStats(eventId: string) {
  const grouped = await db.media.groupBy({
    by: ["status", "type"],
    where: { eventId, status: { in: ["pending", "approved", "rejected", "processing"] } },
    _count: { _all: true },
  });
  const sum = (f: (g: (typeof grouped)[number]) => boolean) =>
    grouped.filter(f).reduce((acc, g) => acc + g._count._all, 0);
  return {
    received: sum(() => true),
    photos: sum((g) => g.type === "photo"),
    videos: sum((g) => g.type === "video"),
    approved: sum((g) => g.status === "approved"),
    pending: sum((g) => g.status === "pending" || g.status === "processing"),
    rejected: sum((g) => g.status === "rejected"),
  };
}

export async function updateUploadSettings(user: Pick<User, "id" | "role">, eventId: string, input: UploadSettingsInput) {
  await assertCan(user, eventId, "configure");
  return db.uploadSettings.update({ where: { eventId }, data: input });
}
