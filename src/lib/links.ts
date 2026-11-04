import type { LinkType, User } from "@prisma/client";
import { config } from "./config";
import { db } from "./db";
import { assertCan } from "./permissions";
import { randomToken } from "./tokens";

export class LinkError extends Error {
  constructor(public reason: "not_found" | "revoked" | "expired" | "archived") {
    super(
      {
        not_found: "Este enlace no existe.",
        revoked: "Este enlace ya no está activo. Pedile el nuevo QR al organizador.",
        expired: "Este enlace venció.",
        archived: "Este evento ya no recibe contenido.",
      }[reason],
    );
  }
}

export const LINK_PATHS: Record<LinkType, string> = { upload: "/e/", screen: "/pantalla/", gallery: "/g/" };

export function linkUrl(type: LinkType, token: string) {
  return `${config.appUrl}${LINK_PATHS[type]}${token}`;
}

/** Finds an active link of the given type. Every public route goes through here. */
export async function resolveLink(token: string, type: LinkType) {
  if (!token || token.length > 64) throw new LinkError("not_found");
  const link = await db.accessLink.findUnique({ where: { token }, include: { event: true } });
  if (!link || link.type !== type) throw new LinkError("not_found");
  if (link.revokedAt) throw new LinkError("revoked");
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) throw new LinkError("expired");
  if (link.event.status !== "active") throw new LinkError("archived");
  return link;
}

export async function getActiveLink(eventId: string, type: LinkType) {
  return db.accessLink.findFirst({ where: { eventId, type, revokedAt: null }, orderBy: { createdAt: "desc" } });
}

/** Revokes the current link of that type and creates a new one with the same expiry. */
export async function regenerateLink(user: Pick<User, "id" | "role">, eventId: string, type: LinkType) {
  await assertCan(user, eventId, "configure");
  return db.$transaction(async (tx) => {
    const current = await tx.accessLink.findFirst({ where: { eventId, type, revokedAt: null } });
    await tx.accessLink.updateMany({ where: { eventId, type, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.accessLink.create({ data: { eventId, type, token: randomToken(), expiresAt: current?.expiresAt ?? null } });
  });
}

export async function setLinkExpiry(user: Pick<User, "id" | "role">, eventId: string, type: LinkType, expiresAt: Date | null) {
  await assertCan(user, eventId, "configure");
  await db.accessLink.updateMany({ where: { eventId, type, revokedAt: null }, data: { expiresAt } });
}
