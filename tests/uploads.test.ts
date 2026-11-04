import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/events";
import { getActiveLink, LinkError, regenerateLink } from "@/lib/links";
import { processMedia } from "@/lib/media/process";
import { mediaQueue } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { localStorageDriver, storage } from "@/lib/storage";
import { completeUpload, createUploads, UploadError } from "@/lib/uploads";
import { photoWithGps, video } from "./fixtures";
import { makeUser, sampleEvent } from "./helpers";

afterAll(async () => {
  await mediaQueue().close();
  redis().disconnect();
});

async function setup(overrides: { autoApprove?: boolean; maxFilesPerGuest?: number; allowVideos?: boolean } = {}) {
  const owner = await makeUser();
  const event = await createEvent(owner, sampleEvent);
  if (overrides.autoApprove) await db.projectionSettings.update({ where: { eventId: event.id }, data: { autoApprove: true } });
  if (overrides.maxFilesPerGuest || overrides.allowVideos === false) {
    await db.uploadSettings.update({
      where: { eventId: event.id },
      data: { ...(overrides.maxFilesPerGuest ? { maxFilesPerGuest: overrides.maxFilesPerGuest } : {}), ...(overrides.allowVideos === false ? { allowVideos: false } : {}) },
    });
  }
  const link = (await getActiveLink(event.id, "upload"))!;
  return { owner, event, token: link.token };
}

const guestReq = (files: { name: string; size: number; type: string }[], name?: string) => ({
  ip: "203.0.113.7", userAgent: "vitest", request: { name, files },
});

/** Simulates the browser PUT to the presigned URL. */
async function putFile(mediaId: string, bytes: Buffer) {
  const m = await db.media.findUniqueOrThrow({ where: { id: mediaId } });
  await storage().put(m.originalKey, bytes, m.mimeType ?? "application/octet-stream");
}

describe("enlaces de invitados", () => {
  it("rechaza un token inexistente o de otro tipo", async () => {
    const { event } = await setup();
    const screen = (await getActiveLink(event.id, "screen"))!;
    await expect(createUploads({ token: "no-existe", ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) })).rejects.toBeInstanceOf(LinkError);
    await expect(createUploads({ token: screen.token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) })).rejects.toMatchObject({ reason: "not_found" });
  });

  it("al regenerar el enlace, el anterior deja de funcionar", async () => {
    const { owner, event, token } = await setup();
    const fresh = await regenerateLink(owner, event.id, "upload");
    expect(fresh.token).not.toBe(token);
    await expect(createUploads({ token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) })).rejects.toMatchObject({ reason: "revoked" });
    await expect(createUploads({ token: fresh.token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) })).resolves.toBeTruthy();
  });

  it("rechaza un enlace vencido", async () => {
    const { event, token } = await setup();
    await db.accessLink.updateMany({ where: { eventId: event.id, type: "upload" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(createUploads({ token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) })).rejects.toMatchObject({ reason: "expired" });
  });
});

describe("validaciones de carga", () => {
  it("rechaza formatos que no son fotos ni videos", async () => {
    const { token } = await setup();
    await expect(createUploads({ token, ...guestReq([{ name: "virus.exe", size: 10, type: "application/x-msdownload" }]) })).rejects.toMatchObject({ code: "bad_type" });
  });

  it("rechaza archivos más pesados que el límite del evento", async () => {
    const { token } = await setup();
    await expect(createUploads({ token, ...guestReq([{ name: "enorme.jpg", size: 26 * 1024 * 1024, type: "image/jpeg" }]) })).rejects.toMatchObject({ code: "too_large" });
  });

  it("rechaza videos si el evento solo acepta fotos", async () => {
    const { token } = await setup({ allowVideos: false });
    await expect(createUploads({ token, ...guestReq([{ name: "v.mp4", size: 1000, type: "video/mp4" }]) })).rejects.toMatchObject({ code: "videos_disabled" });
  });

  it("respeta la cantidad máxima de archivos por invitado entre varios envíos", async () => {
    const { token } = await setup({ maxFilesPerGuest: 3 });
    const first = await createUploads({ token, ...guestReq([1, 2].map((i) => ({ name: `${i}.jpg`, size: 10, type: "image/jpeg" }))) });
    const err = await createUploads({ token, guestToken: first.guestToken, ...guestReq([1, 2].map((i) => ({ name: `${i}.jpg`, size: 10, type: "image/jpeg" }))) }).catch((e) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.message).toBe("Podés subir 1 archivo más.");
  });

  it("guarda el nombre opcional del invitado y lo reutiliza con su sesión", async () => {
    const { token } = await setup();
    const first = await createUploads({ token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }], "Tía Marta") });
    const second = await createUploads({ token, guestToken: first.guestToken, ...guestReq([{ name: "b.jpg", size: 10, type: "image/jpeg" }]) });
    expect(second.guestToken).toBe(first.guestToken);
    const media = await db.media.findUniqueOrThrow({ where: { id: second.uploads[0].mediaId } });
    expect(media.senderName).toBe("Tía Marta");
  });

  it("el archivo se sube a una carpeta propia del evento con un permiso firmado", async () => {
    const { event, token } = await setup();
    const { uploads } = await createUploads({ token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) });
    const media = await db.media.findUniqueOrThrow({ where: { id: uploads[0].mediaId } });
    expect(media.originalKey.startsWith(`events/${event.id}/`)).toBe(true);
    expect(uploads[0].url).toMatch(/\/api\/storage\/object\?.*sig=/);
  });
});

describe("procesamiento", () => {
  it("una foto queda pendiente, sin GPS, con la rotación corregida y sus versiones optimizadas", async () => {
    const { event, token } = await setup();
    const bytes = await photoWithGps();
    const source = await sharp(bytes).metadata();
    expect(source.orientation).toBe(6);
    expect(source.exif).toBeDefined();
    const { uploads, guestToken } = await createUploads({ token, ...guestReq([{ name: "IMG_1.jpg", size: bytes.length, type: "image/jpeg" }]) });
    await putFile(uploads[0].mediaId, bytes);
    await expect(completeUpload({ token, guestToken, mediaId: uploads[0].mediaId })).resolves.toEqual({ status: "processing" });
    await expect(processMedia(uploads[0].mediaId)).resolves.toEqual({ status: "pending" });

    const m = await db.media.findUniqueOrThrow({ where: { id: uploads[0].mediaId } });
    expect([m.width, m.height]).toEqual([2000, 3000]);
    const local = localStorageDriver();
    for (const key of [m.originalKey, m.displayKey!, m.thumbKey!]) expect(await local.size(key)).toBeGreaterThan(0);
    expect(await local.size(`events/${event.id}/media/${m.id}/upload.jpg`)).toBeNull();
    const full = await sharp(await readFile(local.pathFor(m.originalKey))).metadata();
    expect(full.exif).toBeUndefined();
    const display = await sharp(await readFile(local.pathFor(m.displayKey!))).metadata();
    expect(display.format).toBe("webp");
    expect(Math.max(display.width!, display.height!)).toBeLessThanOrEqual(2560);
  });

  it("con aprobación automática la foto queda aprobada directamente", async () => {
    const { token } = await setup({ autoApprove: true });
    const bytes = await photoWithGps();
    const { uploads, guestToken } = await createUploads({ token, ...guestReq([{ name: "a.jpg", size: bytes.length, type: "image/jpeg" }]) });
    await putFile(uploads[0].mediaId, bytes);
    await completeUpload({ token, guestToken, mediaId: uploads[0].mediaId });
    await expect(processMedia(uploads[0].mediaId)).resolves.toEqual({ status: "approved" });
    expect((await db.media.findUniqueOrThrow({ where: { id: uploads[0].mediaId } })).approvedAt).not.toBeNull();
  });

  it("descarta un archivo disfrazado de foto y borra lo subido", async () => {
    const { event, token } = await setup();
    const fake = Buffer.from("<?php system($_GET['c']); ?>".repeat(20));
    const { uploads, guestToken } = await createUploads({ token, ...guestReq([{ name: "foto.jpg", size: fake.length, type: "image/jpeg" }]) });
    await putFile(uploads[0].mediaId, fake);
    await completeUpload({ token, guestToken, mediaId: uploads[0].mediaId });
    await expect(processMedia(uploads[0].mediaId)).resolves.toEqual({ status: "failed", reason: "type_mismatch" });
    expect(await localStorageDriver().size(`events/${event.id}/media/${uploads[0].mediaId}/upload.jpg`)).toBeNull();
  });

  it("convierte un video de celular a MP4 con portada", async () => {
    const { token } = await setup();
    const bytes = await readFile(video(3));
    const { uploads, guestToken } = await createUploads({ token, ...guestReq([{ name: "IMG_2.mov", size: bytes.length, type: "video/quicktime" }]) });
    await putFile(uploads[0].mediaId, bytes);
    await completeUpload({ token, guestToken, mediaId: uploads[0].mediaId });
    await expect(processMedia(uploads[0].mediaId)).resolves.toEqual({ status: "pending" });
    const m = await db.media.findUniqueOrThrow({ where: { id: uploads[0].mediaId } });
    expect(m.displayKey).toMatch(/display\.mp4$/);
    expect(m.posterKey).toMatch(/poster\.webp$/);
    expect(m.durationMs).toBeGreaterThan(2500);
    expect([m.width, m.height]).toEqual([1280, 720]);
  });

  it("rechaza un video más largo que el máximo del evento", async () => {
    const { event, token } = await setup();
    await db.uploadSettings.update({ where: { eventId: event.id }, data: { maxVideoSeconds: 2 } });
    const bytes = await readFile(video(5));
    const { uploads, guestToken } = await createUploads({ token, ...guestReq([{ name: "largo.mov", size: bytes.length, type: "video/quicktime" }]) });
    await putFile(uploads[0].mediaId, bytes);
    await completeUpload({ token, guestToken, mediaId: uploads[0].mediaId });
    await expect(processMedia(uploads[0].mediaId)).resolves.toEqual({ status: "failed", reason: "too_long" });
  });

  it("otro invitado no puede confirmar un archivo ajeno", async () => {
    const { token } = await setup();
    const a = await createUploads({ token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) });
    const b = await createUploads({ token, ...guestReq([{ name: "b.jpg", size: 10, type: "image/jpeg" }]) });
    await expect(completeUpload({ token, guestToken: b.guestToken, mediaId: a.uploads[0].mediaId })).rejects.toMatchObject({ code: "not_found" });
  });

  it("no confirma una subida que nunca llegó al almacenamiento", async () => {
    const { token } = await setup();
    const { uploads, guestToken } = await createUploads({ token, ...guestReq([{ name: "a.jpg", size: 10, type: "image/jpeg" }]) });
    await expect(completeUpload({ token, guestToken, mediaId: uploads[0].mediaId })).rejects.toMatchObject({ code: "missing" });
  });
});
