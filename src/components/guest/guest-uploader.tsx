"use client";

import { Camera, Check, Plus, RotateCcw, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { compressPhoto } from "./compress";

type Limits = { allowVideos: boolean; maxPhotoMb: number; maxVideoMb: number; maxVideoSeconds: number; maxFiles: number };
type EventInfo = { name: string; date: string; color: string; colorText: string };
type Status = "ready" | "preparing" | "uploading" | "done" | "error";
type Item = { id: string; file: File; kind: "photo" | "video"; preview: string; progress: number; status: Status; error?: string };

const MB = 1024 * 1024;
const CONCURRENCY = 3;
const NAME_KEY = "fq_guest_name";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(Object.assign(new Error(xhr.status === 413 ? "Archivo demasiado grande." : "No se pudo subir."), { retry: xhr.status >= 500 })));
    xhr.onerror = () => reject(Object.assign(new Error("Se cortó la conexión."), { retry: true }));
    xhr.send(file);
  });
}

/** fetch that retries network failures (not HTTP errors) a few times. Resolves to null if it never connects. */
async function fetchRetry(url: string, init: RequestInit): Promise<Response | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetch(url, init);
    } catch {
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  return null;
}

/** Venue Wi-Fi drops connections now and then: retry network errors a few times before showing an error. */
async function putWithRetry(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await putWithProgress(url, headers, file, onProgress);
    } catch (e) {
      if (!(e as { retry?: boolean }).retry || attempt >= 4) throw e;
      onProgress(0);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

export function GuestUploader({ token, event, limits }: { token: string; event: EventInfo; limits: Limits }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<"pick" | "sending" | "done">("pick");
  const [notice, setNotice] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch {}
  }, []);

  const update = (id: string, patch: Partial<Item>) => {
    itemsRef.current = itemsRef.current.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(itemsRef.current);
  };

  function addFiles(list: FileList | null, kind: "photo" | "video") {
    if (!list?.length) return;
    setNotice(null);
    const room = limits.maxFiles - sentCount - items.length;
    const accepted: Item[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      const isVideo = file.type.startsWith("video/") || /\.(mov|mp4|webm|3gp|m4v)$/i.test(file.name);
      const realKind = isVideo ? "video" : "photo";
      if (realKind !== kind && !(kind === "photo" && !isVideo)) { rejected.push(`${file.name}: tipo incorrecto`); continue; }
      const max = (realKind === "photo" ? limits.maxPhotoMb : limits.maxVideoMb) * MB;
      if (file.size > max) { rejected.push(`${file.name} pesa más de ${max / MB} MB`); continue; }
      if (accepted.length >= room) { rejected.push(`Máximo ${limits.maxFiles} archivos por persona`); break; }
      accepted.push({ id: uid(), file, kind: realKind, preview: URL.createObjectURL(file), progress: 0, status: "ready" });
    }
    setItems((prev) => [...prev, ...accepted]);
    if (rejected.length) setNotice(rejected.slice(0, 3).join(" · "));
  }

  function remove(id: string) {
    setItems((list) => {
      const it = list.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.preview);
      return list.filter((i) => i.id !== id);
    });
  }

  async function send() {
    const pending = items.filter((i) => i.status === "ready" || i.status === "error");
    if (!pending.length) return;
    setPhase("sending");
    setNotice(null);
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}

    // 1. Shrink photos in the phone.
    const prepared: { item: Item; file: File }[] = [];
    for (const item of pending) {
      update(item.id, { status: "preparing", error: undefined, progress: 0 });
      prepared.push({ item, file: item.kind === "photo" ? await compressPhoto(item.file) : item.file });
    }

    // 2. Ask the server for signed upload URLs, in batches of 20.
    const targets = new Map<string, { mediaId: string; url: string; headers: Record<string, string> }>();
    for (let i = 0; i < prepared.length; i += 20) {
      const batch = prepared.slice(i, i + 20);
      const res = await fetchRetry(`/api/u/${token}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, files: batch.map(({ file }) => ({ name: file.name, size: file.size, type: file.type })) }),
      });
      const body = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) {
        const msg = body.message ?? "No pudimos conectar. Revisá tu conexión.";
        batch.forEach(({ item }) => update(item.id, { status: "error", error: msg }));
        setNotice(msg);
        continue;
      }
      body.uploads.forEach((u: { mediaId: string; url: string; headers: Record<string, string> }, idx: number) => targets.set(batch[idx].item.id, u));
    }

    // 3. Upload straight to storage, three at a time, then confirm each one.
    let ok = 0;
    await runPool(prepared.filter(({ item }) => targets.has(item.id)), CONCURRENCY, async ({ item, file }) => {
      const t = targets.get(item.id)!;
      update(item.id, { status: "uploading" });
      try {
        await putWithRetry(t.url, t.headers, file, (p) => update(item.id, { progress: p }));
        const res = await fetchRetry(`/api/u/${token}/uploads/${t.mediaId}/complete`, { method: "POST" }); // safe to repeat
        if (!res) throw new Error("Se cortó la conexión.");
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "No se pudo confirmar.");
        update(item.id, { status: "done", progress: 1 });
        ok += 1;
      } catch (e) {
        update(item.id, { status: "error", error: e instanceof Error ? e.message : "Error" });
      }
    });

    setSentCount((c) => c + ok);
    const failed = itemsRef.current.filter((i) => i.status === "error");
    if (!failed.length) {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
      setItems([]);
      setPhase("done");
      return;
    }
    itemsRef.current.filter((i) => i.status === "done").forEach((i) => URL.revokeObjectURL(i.preview));
    setItems(itemsRef.current.filter((i) => i.status !== "done"));
    setPhase("pick");
    setNotice(`${failed.length} archivo${failed.length === 1 ? "" : "s"} no se ${failed.length === 1 ? "pudo" : "pudieron"} enviar. Tocá "Reintentar".`);
  }

  const total = items.length;
  const overall = total ? items.reduce((a, i) => a + i.progress, 0) / total : 0;
  const hasErrors = items.some((i) => i.status === "error");

  return (
    <main className="min-h-dvh bg-paper pb-36 text-on-paper">
      <div className="h-2" style={{ background: event.color }} />
      <div className="mx-auto max-w-lg px-5 pt-8">
        <p className="eyebrow text-on-paper-muted">{event.date}</p>
        <h1 className="display mt-3 text-[44px] sm:text-6xl">{event.name}</h1>

        {phase === "done" ? (
          <section className="mt-10 text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-full" style={{ background: event.color, color: event.colorText }}>
              <Check className="size-10" strokeWidth={2.5} />
            </span>
            <h2 className="display mt-6 text-5xl">¡Gracias{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}!</h2>
            <p className="mt-3 text-lg text-on-paper-muted">Tus fotos ya están en camino a la pantalla grande.</p>
            <button onClick={() => { setPhase("pick"); setNotice(null); }} className="mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-on-paper px-8 text-lg font-semibold text-paper">
              <Plus className="size-5" /> Subir más
            </button>
          </section>
        ) : (
          <>
            <p className="mt-3 text-lg text-on-paper-muted">Subí tus fotos y videos para verlos en la pantalla del salón.</p>

            <label className="mt-8 block">
              <span className="eyebrow text-on-paper-muted">Tu nombre (opcional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Ej: Tía Marta"
                disabled={phase === "sending"}
                className="mt-2 h-14 w-full rounded-[12px] border border-on-paper/20 bg-white/70 px-4 text-lg outline-none placeholder:text-on-paper-muted/60 focus:border-on-paper"
              />
            </label>

            <div className={`mt-5 grid gap-3 ${limits.allowVideos ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                type="button" disabled={phase === "sending"} onClick={() => photoInput.current?.click()}
                className="flex aspect-[4/3] flex-col items-start justify-between rounded-[16px] p-5 text-left transition active:scale-[0.98] disabled:opacity-50"
                style={{ background: event.color, color: event.colorText }}
              >
                <Camera className="size-8" />
                <span><span className="block text-xl font-bold">Subir fotos</span><span className="text-sm opacity-80">Podés elegir varias</span></span>
              </button>
              {limits.allowVideos && (
                <button
                  type="button" disabled={phase === "sending"} onClick={() => videoInput.current?.click()}
                  className="flex aspect-[4/3] flex-col items-start justify-between rounded-[16px] bg-on-paper p-5 text-left text-paper transition active:scale-[0.98] disabled:opacity-50"
                >
                  <Video className="size-8" />
                  <span><span className="block text-xl font-bold">Subir videos</span><span className="text-sm opacity-70">Hasta {limits.maxVideoSeconds} seg</span></span>
                </button>
              )}
            </div>
            <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files, "photo"); e.target.value = ""; }} />
            <input ref={videoInput} type="file" accept="video/*" multiple hidden onChange={(e) => { addFiles(e.target.files, "video"); e.target.value = ""; }} />

            {notice && <p role="alert" className="mt-5 rounded-[12px] bg-primary/15 px-4 py-3 text-[15px] text-on-paper">{notice}</p>}

            {total > 0 && (
              <section className="mt-8">
                <p className="eyebrow text-on-paper-muted">{total} seleccionado{total === 1 ? "" : "s"}</p>
                <ul className="mt-3 grid grid-cols-3 gap-2">
                  {items.map((it) => (
                    <li key={it.id} className="relative aspect-square overflow-hidden rounded-[10px] bg-on-paper/10">
                      {it.kind === "photo" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.preview} alt="" className="size-full object-cover" />
                      ) : (
                        <video src={it.preview} muted playsInline preload="metadata" className="size-full object-cover" />
                      )}
                      {it.kind === "video" && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white"><Video className="size-3.5" /></span>}
                      {it.status === "ready" && phase !== "sending" && (
                        <button onClick={() => remove(it.id)} aria-label="Quitar" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white">
                          <X className="size-4" />
                        </button>
                      )}
                      {(it.status === "uploading" || it.status === "preparing") && (
                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
                          <div className="h-full transition-[width]" style={{ width: `${Math.round(it.progress * 100)}%`, background: event.color }} />
                        </div>
                      )}
                      {it.status === "done" && <span className="absolute inset-0 grid place-items-center bg-black/35 text-white"><Check className="size-8" /></span>}
                      {it.status === "error" && (
                        <span className="absolute inset-0 grid place-items-center bg-red-900/60 p-2 text-center text-xs font-medium text-white">{it.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {phase !== "done" && total > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-on-paper/10 bg-paper/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          <div className="mx-auto max-w-lg">
            {phase === "sending" ? (
              <div>
                <div className="flex justify-between text-sm font-medium"><span>Enviando…</span><span className="font-mono">{Math.round(overall * 100)}%</span></div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-on-paper/10">
                  <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(overall * 100)}%`, background: event.color }} />
                </div>
              </div>
            ) : (
              <button onClick={send} className="flex h-15 w-full items-center justify-center gap-2 rounded-full bg-on-paper text-lg font-semibold text-paper active:scale-[0.99]">
                {hasErrors ? <><RotateCcw className="size-5" /> Reintentar</> : <>Enviar {total} archivo{total === 1 ? "" : "s"} →</>}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
