import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileTypeFromFile } from "file-type";
import sharp from "sharp";
import { db } from "../db";
import { publish } from "../realtime";
import { keys, storage } from "../storage";

const run = promisify(execFile);

const DISPLAY_MAX = 2560; // what the projection shows
const FULL_MAX = 4096;    // what the gallery downloads
const THUMB_MAX = 480;    // moderation grid and gallery grid
const VIDEO_MAX = 1920;   // longest side of the converted video

export class ProcessingError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

const PHOTO_MAGIC = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"]);
const VIDEO_MAGIC = new Set(["video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-m4v", "video/x-matroska"]);

async function decodeHeic(file: string): Promise<Buffer> {
  const { default: convert } = (await import("heic-convert")) as unknown as {
    default: (o: { buffer: Buffer; format: "JPEG"; quality: number }) => Promise<ArrayBuffer>;
  };
  return Buffer.from(await convert({ buffer: await readFile(file), format: "JPEG", quality: 0.95 }));
}

/** Re-encodes a photo. Re-encoding drops EXIF/GPS and anything hidden in the original bytes. */
export async function processPhoto(input: string, detectedMime: string, outDir: string) {
  const source = detectedMime === "image/heic" || detectedMime === "image/heif" ? await decodeHeic(input) : input;
  const base = sharp(source, { failOn: "error", limitInputPixels: 120_000_000 }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new ProcessingError("unreadable_image");
  // .rotate() applied EXIF orientation; swap dimensions when it was a 90° turn.
  const turned = (meta.orientation ?? 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const height = turned ? meta.width : meta.height;

  const full = path.join(outDir, "full.jpg");
  const display = path.join(outDir, "display.webp");
  const thumb = path.join(outDir, "thumb.webp");
  // Decode and rotate once, then encode the three sizes in parallel from that pixel buffer.
  // Re-encoding drops all metadata (GPS, camera serials) by default.
  const { data, info } = await base.resize(FULL_MAX, FULL_MAX, { fit: "inside", withoutEnlargement: true })
    .removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const pixels = () => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  await Promise.all([
    pixels().jpeg({ quality: 88 }).toFile(full),
    pixels().resize(DISPLAY_MAX, DISPLAY_MAX, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 2 }).toFile(display),
    pixels().resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true }).webp({ quality: 72, effort: 2 }).toFile(thumb),
  ]);
  return { width, height, full, display, thumb };
}

type Probe = { durationMs: number; width: number; height: number };

export async function probeVideo(input: string): Promise<Probe> {
  let out: string;
  try {
    ({ stdout: out } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", input]));
  } catch {
    throw new ProcessingError("unreadable_video");
  }
  const info = JSON.parse(out) as { format?: { duration?: string }; streams?: Array<{ codec_type: string; width?: number; height?: number; tags?: { rotate?: string }; side_data_list?: Array<{ rotation?: number }> }> };
  const v = info.streams?.find((s) => s.codec_type === "video");
  const durationMs = Math.round(Number(info.format?.duration ?? 0) * 1000);
  if (!v || !v.width || !v.height || !durationMs) throw new ProcessingError("unreadable_video");
  const rotation = Math.abs(Number(v.tags?.rotate ?? v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0));
  const turned = rotation === 90 || rotation === 270;
  return { durationMs, width: turned ? v.height : v.width, height: turned ? v.width : v.height };
}

/** Converts any phone video to H.264/AAC MP4 that every browser and TV plays, plus a poster frame. */
export async function processVideo(input: string, maxSeconds: number, outDir: string) {
  const probe = await probeVideo(input);
  if (probe.durationMs > (maxSeconds + 1) * 1000) throw new ProcessingError("too_long");

  const video = path.join(outDir, "display.mp4");
  const posterRaw = path.join(outDir, "poster.png");
  const scale = `scale='if(gt(iw,ih),min(${VIDEO_MAX},iw),-2)':'if(gt(iw,ih),-2,min(${VIDEO_MAX},ih))'`;
  try {
    await run("ffmpeg", [
      "-y", "-v", "error", "-i", input,
      "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1",
      "-vf", `${scale},format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high",
      "-c:a", "aac", "-b:a", "128k", "-ac", "2",
      "-movflags", "+faststart", video,
    ], { timeout: 10 * 60 * 1000 });
    const at = Math.min(1, probe.durationMs / 2000).toFixed(2);
    await run("ffmpeg", ["-y", "-v", "error", "-ss", at, "-i", video, "-frames:v", "1", posterRaw]);
  } catch {
    throw new ProcessingError("transcode_failed");
  }
  const poster = path.join(outDir, "poster.webp");
  const thumb = path.join(outDir, "thumb.webp");
  await sharp(posterRaw).webp({ quality: 82 }).toFile(poster);
  await sharp(posterRaw).resize(THUMB_MAX, THUMB_MAX, { fit: "inside" }).webp({ quality: 74 }).toFile(thumb);
  const { width, height } = await sharp(poster).metadata();
  return { durationMs: probe.durationMs, width: width ?? probe.width, height: height ?? probe.height, video, poster, thumb };
}

/** Worker entry point: validates, optimizes and stores a guest upload, then hands it to moderation. */
export async function processMedia(mediaId: string) {
  const media = await db.media.findUnique({
    where: { id: mediaId },
    include: { event: { include: { projectionSettings: true, uploadSettings: true } } },
  });
  if (!media || media.status !== "processing") return { skipped: true as const };

  const s = storage();
  const dir = await mkdtemp(path.join(tmpdir(), "fq-"));
  const input = path.join(dir, "input");
  try {
    await s.download(media.originalKey, input);
    const detected = (await fileTypeFromFile(input))?.mime ?? "unknown";
    const allowed = media.type === "photo" ? PHOTO_MAGIC : VIDEO_MAGIC;
    if (!allowed.has(detected)) throw new ProcessingError("type_mismatch");

    const { eventId } = media;
    let data: Record<string, unknown>;
    if (media.type === "photo") {
      const p = await processPhoto(input, detected, dir);
      const fullKey = keys.full(eventId, media.id, "jpg");
      const displayKey = keys.display(eventId, media.id, "webp");
      const thumbKey = keys.thumb(eventId, media.id);
      await s.put(fullKey, await readFile(p.full), "image/jpeg");
      await s.put(displayKey, await readFile(p.display), "image/webp");
      await s.put(thumbKey, await readFile(p.thumb), "image/webp");
      data = { width: p.width, height: p.height, originalKey: fullKey, displayKey, thumbKey, mimeType: "image/jpeg" };
    } else {
      const v = await processVideo(input, media.event.uploadSettings?.maxVideoSeconds ?? 60, dir);
      const displayKey = keys.display(eventId, media.id, "mp4");
      const posterKey = keys.poster(eventId, media.id);
      const thumbKey = keys.thumb(eventId, media.id);
      await s.put(displayKey, await readFile(v.video), "video/mp4");
      await s.put(posterKey, await readFile(v.poster), "image/webp");
      await s.put(thumbKey, await readFile(v.thumb), "image/webp");
      // The converted MP4 is also what the gallery downloads.
      data = { width: v.width, height: v.height, durationMs: v.durationMs, originalKey: displayKey, displayKey, posterKey, thumbKey, mimeType: "video/mp4" };
    }
    // The raw upload may carry GPS and other metadata: keep only the cleaned versions.
    await s.delete(media.originalKey);

    const auto = media.event.projectionSettings?.autoApprove ?? false;
    const now = new Date();
    const updated = await db.media.update({
      where: { id: media.id },
      data: { ...data, status: auto ? "approved" : "pending", approvedAt: auto ? now : null },
    });
    await publish(eventId, { type: "media.updated", mediaId: media.id, status: updated.status });
    return { status: updated.status };
  } catch (e) {
    if (e instanceof ProcessingError) {
      await s.deletePrefix(keys.mediaPrefix(media.eventId, media.id));
      await db.media.update({ where: { id: media.id }, data: { status: "failed", failReason: e.reason } });
      await publish(media.eventId, { type: "media.updated", mediaId: media.id, status: "failed" });
      return { status: "failed" as const, reason: e.reason };
    }
    throw e; // unexpected (storage, network): let the queue retry
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
