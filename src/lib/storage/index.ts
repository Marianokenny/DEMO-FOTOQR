import { config } from "../config";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { StorageDriver } from "./types";

let instance: StorageDriver | null = null;

export function storage(): StorageDriver {
  instance ??= config.storageDriver === "s3" ? new S3Storage() : new LocalStorage();
  return instance;
}

export function localStorageDriver(): LocalStorage {
  const s = storage();
  if (!(s instanceof LocalStorage)) throw new Error("El almacenamiento local no está activo");
  return s;
}

export const keys = {
  eventPrefix: (eventId: string) => `events/${eventId}/`,
  upload: (eventId: string, mediaId: string, ext: string) => `events/${eventId}/media/${mediaId}/upload.${ext}`,
  full: (eventId: string, mediaId: string, ext: string) => `events/${eventId}/media/${mediaId}/full.${ext}`,
  display: (eventId: string, mediaId: string, ext: string) => `events/${eventId}/media/${mediaId}/display.${ext}`,
  thumb: (eventId: string, mediaId: string) => `events/${eventId}/media/${mediaId}/thumb.webp`,
  poster: (eventId: string, mediaId: string) => `events/${eventId}/media/${mediaId}/poster.webp`,
  mediaPrefix: (eventId: string, mediaId: string) => `events/${eventId}/media/${mediaId}/`,
};
