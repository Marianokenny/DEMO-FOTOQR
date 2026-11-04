import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "@/lib/config";
import { localStorageDriver } from "@/lib/storage";
import { verify } from "@/lib/storage/signing";

export const runtime = "nodejs";

/** Local stand-in for S3 presigned URLs. Disabled when the S3/R2 driver is active. */
function guard(url: URL, fields: string[]) {
  if (config.storageDriver !== "local") return { error: new Response("Not found", { status: 404 }) };
  const parts: Record<string, string> = {};
  for (const f of fields) {
    const v = url.searchParams.get(f);
    if (v !== null) parts[f] = v;
  }
  const sig = url.searchParams.get("sig") ?? "";
  if (!parts.key || !parts.exp || !verify(parts, sig)) return { error: new Response("Firma inválida", { status: 403 }) };
  if (Number(parts.exp) * 1000 < Date.now()) return { error: new Response("Enlace vencido", { status: 403 }) };
  return { parts };
}

export async function PUT(req: Request) {
  const { parts, error } = guard(new URL(req.url), ["key", "ct", "max", "exp"]);
  if (error) return error;
  if ((req.headers.get("content-type") ?? "") !== parts.ct) return new Response("Tipo de archivo distinto al autorizado", { status: 400 });
  const max = Number(parts.max);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) return new Response("Archivo demasiado grande", { status: 413 });
  if (!req.body) return new Response("Sin contenido", { status: 400 });

  const driver = localStorageDriver();
  const file = driver.pathFor(parts.key);
  await mkdir(path.dirname(file), { recursive: true });
  let written = 0;
  const limited = Readable.fromWeb(req.body as import("node:stream/web").ReadableStream).on("data", (chunk: Buffer) => {
    written += chunk.length;
    if (written > max) limited.destroy(new Error("too_large"));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(file);
      limited.on("error", reject).pipe(out).on("finish", resolve).on("error", reject);
    });
  } catch (e) {
    await rm(file, { force: true });
    if (written > max) return new Response("Archivo demasiado grande", { status: 413 });
    console.error("[storage] no se pudo guardar", parts.key, (e as Error).message);
    return new Response("No se pudo guardar el archivo", { status: 500 });
  }
  return new Response(null, { status: 200 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { parts, error } = guard(url, ["key", "exp", "dn"]);
  if (error) return error;
  const driver = localStorageDriver();
  const size = await driver.size(parts.key);
  if (size === null) return new Response("No encontrado", { status: 404 });
  const ext = path.extname(parts.key).slice(1);
  const type = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", mp4: "video/mp4" }[ext] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type, "Cache-Control": "private, max-age=3600", "Accept-Ranges": "bytes",
    // Guest files are never rendered as a document of this site.
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'",
  };
  if (parts.dn) headers["Content-Disposition"] = `attachment; filename="${parts.dn}"`;
  // Byte ranges: iPhone Safari only plays video when the server answers them, and they allow seeking.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && size > 0 && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (!range[1]) end = size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    start = Math.max(0, start);
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    headers["Content-Length"] = String(end - start + 1);
    const stream = Readable.toWeb(driver.readStream(parts.key, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }
  headers["Content-Length"] = String(size);
  const stream = Readable.toWeb(driver.readStream(parts.key)) as ReadableStream;
  return new Response(stream, { headers });
}
