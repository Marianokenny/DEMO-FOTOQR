import type { MediaType } from "@prisma/client";

/** Formats guests may upload. Video formats cover iPhone (mov), Android (mp4/3gp) and browsers (webm). */
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
};
export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/3gpp": "3gp", "video/x-m4v": "m4v",
};

export function kindOf(mime: string): MediaType | null {
  if (mime in PHOTO_TYPES) return "photo";
  if (mime in VIDEO_TYPES) return "video";
  return null;
}

export function extensionOf(mime: string): string {
  return PHOTO_TYPES[mime] ?? VIDEO_TYPES[mime] ?? "bin";
}

/** Some phones send HEIC with an empty type; fall back to the file name. */
export function normalizeMime(type: string, fileName: string): string {
  if (type) return type.toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const all = { ...PHOTO_TYPES, ...VIDEO_TYPES };
  return Object.entries(all).find(([, e]) => e === ext)?.[0] ?? "";
}
