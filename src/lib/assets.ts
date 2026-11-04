import type { AssetUsage, User } from "@prisma/client";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { readAppearance, type Appearance } from "./appearance";
import { db } from "./db";
import { assertCan } from "./permissions";
import { publish } from "./realtime";
import { storage } from "./storage";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 3840; // 4K screens

export class AssetError extends Error {}

type Actor = Pick<User, "id" | "role">;

/** Organizer images for the screen (backgrounds, overlays). PNG transparency is kept. */
export async function addAsset(user: Actor, eventId: string, usage: AssetUsage, bytes: Buffer) {
  await assertCan(user, eventId, "configure");
  if (bytes.length > MAX_BYTES) throw new AssetError("La imagen pesa más de 15 MB.");
  const type = await fileTypeFromBuffer(bytes);
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime)) throw new AssetError("Subí una imagen JPG, PNG o WEBP.");
  let out: { data: Buffer; info: sharp.OutputInfo };
  try {
    out = await sharp(bytes, { limitInputPixels: 120_000_000 }).rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 }).toBuffer({ resolveWithObject: true });
  } catch {
    throw new AssetError("No pudimos leer la imagen.");
  }
  const asset = await db.asset.create({ data: { eventId, usage, key: "", mimeType: "image/webp", width: out.info.width, height: out.info.height } });
  const key = `events/${eventId}/assets/${asset.id}.webp`;
  await storage().put(key, out.data, "image/webp");
  return db.asset.update({ where: { id: asset.id }, data: { key } });
}

/** Deletes an image and drops every reference to it from the appearance. */
export async function deleteAsset(user: Actor, eventId: string, assetId: string) {
  await assertCan(user, eventId, "configure");
  const asset = await db.asset.findFirst({ where: { id: assetId, eventId } });
  if (!asset) return;
  const settings = await db.projectionSettings.findUniqueOrThrow({ where: { eventId } });
  const a = readAppearance(settings.appearance);
  const cleaned: Appearance = {
    ...a,
    background: { ...a.background, assetId: a.background.assetId === assetId ? null : a.background.assetId },
    layers: a.layers.filter((l) => l.assetId !== assetId),
  };
  await db.projectionSettings.update({ where: { eventId }, data: { appearance: cleaned, version: { increment: 1 } } });
  await storage().delete(asset.key);
  await db.asset.delete({ where: { id: asset.id } });
  await publish(eventId, { type: "settings.updated" });
}

export async function saveAppearance(user: Actor, eventId: string, raw: unknown) {
  await assertCan(user, eventId, "configure");
  const parsed = (await import("./appearance")).appearanceSchema.safeParse(raw);
  if (!parsed.success) throw new AssetError("Apariencia inválida.");
  const value = parsed.data;
  // Only images that belong to this event may be referenced.
  const own = new Set((await db.asset.findMany({ where: { eventId }, select: { id: true } })).map((x) => x.id));
  if (value.background.assetId && !own.has(value.background.assetId)) value.background.assetId = null;
  value.layers = value.layers.filter((l) => own.has(l.assetId));
  await db.projectionSettings.update({ where: { eventId }, data: { appearance: value, version: { increment: 1 } } });
  await publish(eventId, { type: "settings.updated" });
  return value;
}
