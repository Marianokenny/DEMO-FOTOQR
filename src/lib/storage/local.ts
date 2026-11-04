import { createReadStream } from "node:fs";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { sign } from "./signing";
import type { StorageDriver } from "./types";

/** Stores files on disk and imitates S3 presigned URLs with HMAC-signed routes. For development and tests. */
export class LocalStorage implements StorageDriver {
  constructor(private root = path.resolve(config.storageLocalDir)) {}

  pathFor(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Clave de archivo inválida");
    return full;
  }

  async presignUpload(key: string, contentType: string, maxBytes: number, expiresIn = 3600) {
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const parts = { key, ct: contentType, max: maxBytes, exp };
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, String(v)])), sig: sign(parts) });
    return { url: `${config.appUrl}/api/storage/object?${qs}`, method: "PUT" as const, headers: { "Content-Type": contentType } };
  }

  async presignDownload(key: string, expiresIn = 3600, downloadName?: string) {
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const parts: Record<string, string | number> = { key, exp, ...(downloadName ? { dn: downloadName } : {}) };
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, String(v)])), sig: sign(parts) });
    return `${config.appUrl}/api/storage/object?${qs}`;
  }

  async put(key: string, body: Buffer) {
    const p = this.pathFor(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async download(key: string, filePath: string) {
    await copyFile(this.pathFor(key), filePath);
  }

  async size(key: string) {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await rm(this.pathFor(key), { force: true });
  }

  async deletePrefix(prefix: string) {
    await rm(this.pathFor(prefix.replace(/\/$/, "")), { recursive: true, force: true });
  }

  readStream(key: string) {
    return createReadStream(this.pathFor(key));
  }
}
