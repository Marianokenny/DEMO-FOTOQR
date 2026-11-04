/**
 * Load test: N guests upload photos at the same time to a fresh event, the way a party looks
 * when the host says "¡suban sus fotos!". Everyone shares one IP, like the venue Wi-Fi.
 *
 *   npm run load-test -- --guests 200 --photos 3
 *
 * Needs the app (npm start) and the worker running. Creates a test organizer and event and deletes
 * them at the end (pass --keep to look at them in the panel).
 */
import "./env";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { db } from "../src/lib/db";
import { createEvent } from "../src/lib/events";
import { getActiveLink } from "../src/lib/links";
import { registerUser } from "../src/lib/users";

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const GUESTS = arg("guests", 200);
const PHOTOS = arg("photos", 3);
const BASE = process.env.LOAD_TEST_URL ?? "http://localhost:3000";

let retries = 0;

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

async function makePhoto(seed: number) {
  // A phone photo after the guest page compression: ~3000 px, around 1-2 MB.
  const noise = Buffer.alloc(300 * 400 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 31 + seed * 97 + ((i * seed) % 251)) & 255;
  return sharp(noise, { raw: { width: 300, height: 400, channels: 3 } }).resize(2250, 3000, { kernel: "nearest" }).jpeg({ quality: 88 }).toBuffer();
}

async function guest(token: string, n: number, photos: Buffer[]) {
  const t0 = performance.now();
  let cookie = "";
  const body = JSON.stringify({ name: `Invitado ${n}`, files: photos.map((p, i) => ({ name: `IMG_${n}_${i}.jpg`, size: p.length, type: "image/jpeg" })) });
  let res: Response | undefined;
  for (let attempt = 1; !res; attempt++) {
    res = await fetch(`${BASE}/api/u/${token}/uploads`, { method: "POST", headers: { "content-type": "application/json" }, body }).catch((e) => {
      if (attempt >= 3) throw e;
      retries++;
      return new Promise<undefined>((r) => setTimeout(() => r(undefined), 700 * attempt));
    });
  }
  if (!res.ok) throw new Error(`create ${res.status} ${await res.text()}`);
  cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const { uploads } = (await res.json()) as { uploads: { mediaId: string; url: string; headers: Record<string, string> }[] };
  const tCreated = performance.now();
  await Promise.all(uploads.map(async (u, i) => {
    // Same policy as the guest page: retry network errors up to 4 times.
    let put: Response | undefined;
    for (let attempt = 1; !put; attempt++) {
      put = await fetch(u.url, { method: "PUT", headers: u.headers, body: new Uint8Array(photos[i]) }).catch((e) => {
        if (attempt >= 4) throw Object.assign(new Error(`put: ${e.message}`), { cause: e.cause });
        retries++;
        return new Promise<undefined>((r) => setTimeout(() => r(undefined), 800 * attempt));
      });
    }
    if (!put.ok) throw new Error(`put ${put.status}`);
    let done: Response | undefined;
    for (let attempt = 1; !done; attempt++) {
      done = await fetch(`${BASE}/api/u/${token}/uploads/${u.mediaId}/complete`, { method: "POST", headers: { cookie } }).catch((e) => {
        if (attempt >= 3) throw Object.assign(new Error(`complete: ${e.message}`), { cause: e.cause });
        retries++;
        return new Promise<undefined>((r) => setTimeout(() => r(undefined), 700 * attempt));
      });
    }
    if (!done.ok) throw new Error(`complete ${done.status} ${await done.text()}`);
  }));
  return { create: tCreated - t0, total: performance.now() - t0, ids: uploads.map((u) => u.mediaId) };
}

async function main() {
  const owner = await registerUser({ name: "Prueba de carga", email: `carga-${Date.now()}@test.local`, password: "prueba-de-carga-123" });
  const event = await createEvent(owner, {
    name: `Prueba de carga ${new Date().toLocaleString("es-AR")}`, type: "party", date: new Date(), venue: undefined,
    brandColor: "#FF5B2E", storageDays: 1,
  });
  await db.projectionSettings.update({ where: { eventId: event.id }, data: { autoApprove: true, enabled: true } });
  await db.uploadSettings.update({ where: { eventId: event.id }, data: { maxFilesPerGuest: 100 } });
  const token = (await getActiveLink(event.id, "upload"))!.token;
  const photos = await Promise.all(Array.from({ length: PHOTOS }, (_, i) => makePhoto(i + 1)));
  const mb = photos.reduce((a, p) => a + p.length, 0) / 1e6;
  console.log(`Evento ${event.id}: ${GUESTS} invitados × ${PHOTOS} fotos (${mb.toFixed(1)} MB por invitado, ${(mb * GUESTS / 1000).toFixed(2)} GB en total)`);

  const start = performance.now();
  const results = await Promise.allSettled(Array.from({ length: GUESTS }, (_, n) => guest(token, n + 1, photos)));
  const uploadSecs = (performance.now() - start) / 1000;
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof guest>>>).value);
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  console.log(`Subidas: ${ok.length} invitados OK, ${failed.length} con error, en ${uploadSecs.toFixed(1)} s`);
  if (retries) console.log(`  ${retries} pedidos cortados se reintentaron solos`);
  const reasons = new Map<string, number>();
  for (const f of failed) {
    const e = f.reason as Error & { cause?: { code?: string; message?: string } };
    const key = `${e.message}${e.cause ? ` (${e.cause.code ?? e.cause.message})` : ""}`.slice(0, 160);
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  reasons.forEach((n, r) => console.log(`  ${n} × ${r}`));
  if (ok.length) {
    console.log(`  pedir permiso: p50 ${pct(ok.map((r) => r.create), 50)} ms, p95 ${pct(ok.map((r) => r.create), 95)} ms`);
    console.log(`  invitado completo (permiso + subir + confirmar): p50 ${pct(ok.map((r) => r.total), 50)} ms, p95 ${pct(ok.map((r) => r.total), 95)} ms, máx ${pct(ok.map((r) => r.total), 100)} ms`);
  }

  const cleanup = async () => {
    if (process.argv.includes("--keep")) return;
    // Removes the test event and its files so repeated runs do not fill the disk.
    const { storage, keys } = await import("../src/lib/storage");
    await storage().deletePrefix(keys.eventPrefix(event.id));
    await db.event.delete({ where: { id: event.id } });
    await db.user.delete({ where: { id: owner.id } });
    console.log("Evento de prueba borrado (usá --keep para conservarlo).");
  };
  if (process.argv.includes("--no-wait")) { await cleanup(); await db.$disconnect(); process.exit(0); }
  // Wait for the worker to process everything.
  const expected = ok.length * PHOTOS;
  let last = -1;
  for (;;) {
    const counts = await db.media.groupBy({ by: ["status"], where: { eventId: event.id }, _count: true });
    const by = Object.fromEntries(counts.map((c) => [c.status, c._count]));
    const finished = (by.approved ?? 0) + (by.failed ?? 0);
    if (finished !== last) { console.log(`  procesadas ${finished}/${expected}`, JSON.stringify(by)); last = finished; }
    if (finished >= expected) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  const totalSecs = (performance.now() - start) / 1000;
  console.log(`Todo procesado y en pantalla en ${totalSecs.toFixed(0)} s (${(expected / totalSecs).toFixed(1)} fotos por segundo)`);
  await cleanup();
  await db.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
