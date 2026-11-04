import { z } from "zod";
import { db } from "./db";
import { resolveLink } from "./links";
import { extensionOf, kindOf, normalizeMime } from "./media/formats";
import { enqueueMediaProcessing } from "./queue";
import { consume } from "./rate-limit";
import { publish } from "./realtime";
import { keys, storage } from "./storage";
import { randomToken, sha256 } from "./tokens";

const MB = 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 20;

export class UploadError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export const uploadRequestSchema = z.object({
  name: z.string().trim().max(60).optional().transform((v) => v || undefined),
  files: z
    .array(z.object({ name: z.string().max(255), size: z.number().int().positive(), type: z.string().max(100) }))
    .min(1)
    .max(MAX_FILES_PER_REQUEST),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/** Public info the guest page needs. */
export async function getGuestEvent(token: string) {
  const link = await resolveLink(token, "upload");
  const settings = await db.uploadSettings.findUniqueOrThrow({ where: { eventId: link.eventId } });
  return { link, event: link.event, settings };
}

async function findOrCreateGuest(eventId: string, guestToken: string | undefined, name: string | undefined, ip: string, userAgent: string) {
  if (guestToken) {
    const existing = await db.guestSession.findUnique({ where: { tokenHash: sha256(guestToken) } });
    if (existing && existing.eventId === eventId) {
      if (name && name !== existing.name) await db.guestSession.update({ where: { id: existing.id }, data: { name } });
      return { guest: { ...existing, name: name ?? existing.name }, token: guestToken, isNew: false };
    }
  }
  if (!(await consume(`guest-new:${eventId}:${sha256(ip)}`, 1, 300, 600))) {
    throw new UploadError("rate_limited", "Demasiados intentos desde esta red. Esperá unos minutos.", 429);
  }
  const token = randomToken(24);
  const guest = await db.guestSession.create({
    data: { eventId, tokenHash: sha256(token), name, ipHash: sha256(ip), userAgent: userAgent.slice(0, 300) },
  });
  return { guest, token, isNew: true };
}

/**
 * Registers the files a guest picked and returns one presigned URL per file.
 * The browser uploads straight to storage; our server never carries the bytes.
 */
export async function createUploads(opts: {
  token: string; guestToken?: string; ip: string; userAgent: string; request: UploadRequest;
}) {
  const { link, event, settings } = await getGuestEvent(opts.token);
  const { request } = opts;

  const files = request.files.map((f) => {
    const mime = normalizeMime(f.type, f.name);
    const kind = kindOf(mime);
    if (!kind) throw new UploadError("bad_type", `"${f.name}" no es una foto o video compatible.`);
    if (kind === "video" && !settings.allowVideos) throw new UploadError("videos_disabled", "En este evento solo se pueden subir fotos.");
    const maxBytes = (kind === "photo" ? settings.maxPhotoMb : settings.maxVideoMb) * MB;
    if (f.size > maxBytes) {
      throw new UploadError("too_large", `"${f.name}" pesa más de ${kind === "photo" ? settings.maxPhotoMb : settings.maxVideoMb} MB.`);
    }
    return { ...f, mime, kind, maxBytes };
  });

  const { guest, token: guestToken } = await findOrCreateGuest(event.id, opts.guestToken, request.name, opts.ip, opts.userAgent);

  const used = await db.media.count({ where: { guestSessionId: guest.id, status: { notIn: ["failed", "deleted"] } } });
  if (used + files.length > settings.maxFilesPerGuest) {
    const left = Math.max(0, settings.maxFilesPerGuest - used);
    throw new UploadError("guest_limit", left ? `Podés subir ${left} archivo${left === 1 ? "" : "s"} más.` : "Llegaste al máximo de archivos para este evento.");
  }
  // Generous per-network limit: everyone at the venue may share one Wi-Fi IP.
  if (!(await consume(`files:${event.id}:${sha256(opts.ip)}`, files.length, 2000, 600))) {
    throw new UploadError("rate_limited", "Hay demasiadas subidas desde esta red. Probá de nuevo en unos minutos.", 429);
  }

  const uploads = [];
  for (const f of files) {
    const media = await db.media.create({
      data: {
        eventId: event.id, guestSessionId: guest.id, senderName: guest.name, type: f.kind, status: "uploading",
        originalKey: "", mimeType: f.mime, sizeBytes: BigInt(f.size),
      },
    });
    const key = keys.upload(event.id, media.id, extensionOf(f.mime));
    await db.media.update({ where: { id: media.id }, data: { originalKey: key } });
    const presigned = await storage().presignUpload(key, f.mime, f.maxBytes, 3 * 3600);
    uploads.push({ mediaId: media.id, fileName: f.name, ...presigned });
  }
  return { guestToken, eventId: link.eventId, uploads };
}

/** Called by the browser after its PUT finished: verifies the object and queues processing. */
export async function completeUpload(opts: { token: string; guestToken?: string; mediaId: string }) {
  const { event, settings } = await getGuestEvent(opts.token);
  if (!opts.guestToken) throw new UploadError("no_session", "Sesión de invitado no encontrada.", 403);
  const media = await db.media.findUnique({ where: { id: opts.mediaId }, include: { guestSession: true } });
  if (!media || media.eventId !== event.id || media.guestSession?.tokenHash !== sha256(opts.guestToken)) {
    throw new UploadError("not_found", "Archivo no encontrado.", 404);
  }
  if (media.status !== "uploading") return { status: media.status };

  const size = await storage().size(media.originalKey);
  const maxBytes = (media.type === "photo" ? settings.maxPhotoMb : settings.maxVideoMb) * MB;
  if (size === null || size === 0) throw new UploadError("missing", "El archivo no terminó de subirse. Probá de nuevo.", 409);
  if (size > maxBytes) {
    await storage().delete(media.originalKey);
    await db.media.update({ where: { id: media.id }, data: { status: "failed", failReason: "too_large" } });
    throw new UploadError("too_large", "El archivo supera el tamaño permitido.");
  }
  await db.media.update({ where: { id: media.id }, data: { status: "processing", sizeBytes: BigInt(size) } });
  await enqueueMediaProcessing(media.id);
  await publish(event.id, { type: "media.created", mediaId: media.id });
  return { status: "processing" as const };
}
