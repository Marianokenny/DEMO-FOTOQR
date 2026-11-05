"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Mascot } from "@/components/brand/mascot";
import { ROBOT_MOVE_LABELS, ROBOT_MOVES, type Features, type RobotMove } from "@/lib/features";
import type { LiveState } from "@/lib/live";
import type { MediaItem } from "@/lib/moderation";

type Cmd =
  | { kind: "playNow" | "pin"; mediaId: string }
  | { kind: "unpin" | "skip" | "pause" | "resume" | "qr" | "leaderboard" | "winner" | "selfie" }
  | { kind: "robot"; move: RobotMove | "random" | null; mediaId?: string };

export function LiveControl({ eventId, initialLive, initialFeatures, projectionOn, canConfigure }: {
  eventId: string; initialLive: LiveState; initialFeatures: Features; projectionOn: boolean; canConfigure: boolean;
}) {
  const [live, setLive] = useState(initialLive);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [picked, setPicked] = useState<MediaItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [beat, setBeat] = useState(initialFeatures.beat);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = (t: string) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/media?status=approved`, { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items);
  }, [eventId]);

  useEffect(() => {
    void load();
    const es = new EventSource(`/api/events/${eventId}/live`);
    let t: ReturnType<typeof setTimeout> | undefined;
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "screen.now") setLive((l) => ({ ...l, nowId: msg.nowId, nextId: msg.nextId, paused: msg.paused, pinnedId: msg.pinnedId }));
      if (msg.type === "media.updated" || msg.type === "media.removed") { clearTimeout(t); t = setTimeout(load, 400); }
    };
    return () => { es.close(); clearTimeout(t); };
  }, [eventId, load]);

  async function send(cmd: Cmd, done: string) {
    if (navigator.vibrate) navigator.vibrate(15);
    const res = await fetch(`/api/events/${eventId}/control`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cmd) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return say(body.message ?? "No se pudo enviar.");
    setLive(body);
    say(done);
  }

  async function markRobot(item: MediaItem, move: RobotMove | "random" | null) {
    await send({ kind: "robot", mediaId: item.id, move }, move ? "El robot va a aparecer en esta foto" : "Foto sin robot");
    setItems((list) => list.map((x) => (x.id === item.id ? { ...x, robotMove: move } : x)));
    setPicked((p) => (p && p.id === item.id ? { ...p, robotMove: move } : p));
  }

  // Beat settings: saved shortly after the last change; the screen updates on its own.
  const firstBeat = useRef(true);
  useEffect(() => {
    if (firstBeat.current) { firstBeat.current = false; return; }
    const t = setTimeout(async () => {
      await fetch(`/api/events/${eventId}/features`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ beat }) });
    }, 500);
    return () => clearTimeout(t);
  }, [beat, eventId]);

  // Tap tempo: average of the last taps.
  const taps = useRef<number[]>([]);
  function tap() {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now].slice(-8);
    if (taps.current.length >= 3) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      const bpm = Math.round(60_000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
      if (bpm >= 60 && bpm <= 200) setBeat((b) => ({ ...b, bpm, enabled: true }));
    }
  }

  const now = items.find((i) => i.id === live.nowId);
  const next = items.find((i) => i.id === live.nextId);
  const status = live.pinnedId ? "Fijada" : live.paused ? "En pausa" : "Pasando";

  return (
    <div className="space-y-6 pb-24">
      {!projectionOn && (
        <p className="rounded-[12px] border border-warning/50 px-4 py-3 text-sm text-warning">La proyección está apagada. Encendela en la pestaña Proyección para que la pantalla muestre las fotos.</p>
      )}

      {/* Now playing */}
      <section className="overflow-hidden rounded-[16px] border border-line-strong bg-bg-elevated">
        <div className="relative aspect-video bg-black">
          {now?.thumbUrl || now?.displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={now.id} src={now.displayUrl ?? now.thumbUrl!} alt="" className="size-full object-contain" style={{ animation: "fq-rise 500ms both" }} />
          ) : (
            <div className="grid size-full place-items-center text-sm text-muted">{live.nowId ? "Cargando…" : "La pantalla está en espera"}</div>
          )}
          <span className={cn("absolute left-3 top-3 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em]",
            live.pinnedId ? "bg-primary text-on-paper" : live.paused ? "bg-warning text-on-paper" : "bg-black/70 text-paper")}>
            {status}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="eyebrow text-muted">En pantalla</p>
            <p className="truncate font-medium">{now ? (now.senderName ?? "Anónimo") : "—"}</p>
          </div>
          {next && (
            <div className="flex items-center gap-2 text-right">
              <div className="min-w-0">
                <p className="eyebrow text-muted">Sigue</p>
                <p className="truncate text-sm">{next.senderName ?? "Anónimo"}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {next.thumbUrl && <img src={next.thumbUrl} alt="" className="size-11 rounded-[8px] object-cover" />}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 border-t border-line">
          {live.paused ? (
            <Big onClick={() => send({ kind: "resume" }, "Rotación reanudada")} icon="▶" label="Reanudar" accent />
          ) : (
            <Big onClick={() => send({ kind: "pause" }, "Rotación en pausa")} icon="❚❚" label="Pausar" />
          )}
          <Big onClick={() => send({ kind: "skip" }, "Siguiente")} icon="⏭" label="Saltar" />
          {live.pinnedId ? (
            <Big onClick={() => send({ kind: "unpin" }, "Foto liberada")} icon="📌" label="Soltar" accent />
          ) : (
            <Big onClick={() => now && send({ kind: "pin", mediaId: now.id }, "Foto fijada")} icon="📌" label="Fijar esta" disabled={!now} />
          )}
        </div>
      </section>

      {/* Moments */}
      <section>
        <p className="eyebrow mb-3 text-muted">Momentos</p>
        <div className="grid grid-cols-2 gap-2">
          <Moment onClick={() => send({ kind: "qr" }, "QR en pantalla")} icon="▦" title="QR ahora" hint="“¡Subí tu foto!”" />
          <Moment onClick={() => send({ kind: "leaderboard" }, "Ranking en pantalla")} icon="🏁" title="Ranking" hint="Top 5 en vivo" />
          <Moment onClick={() => send({ kind: "selfie" }, "¡Selfie del momento!")} icon="📸" title="Selfie YA" hint="Cuenta regresiva y mosaico" hot />
          <Moment onClick={() => send({ kind: "winner" }, "¡Premio entregado!")} icon="🏆" title="Paparazzi" hint="Premio de la noche" />
        </div>
      </section>

      {/* Robot */}
      <section className="overflow-hidden rounded-[16px] bg-paper text-on-paper">
        <div className="flex items-center gap-3 p-4 pb-2">
          <div className="h-16 shrink-0" style={{ aspectRatio: "260 / 320", animation: "fq-bob 1.6s ease-in-out infinite" }}>
            <Mascot mood="happy" wave className="size-full" />
          </div>
          <div>
            <p className="font-semibold">El robot en pantalla</p>
            <p className="text-sm opacity-70">Tocá un movimiento y aparece ahora sobre la foto.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-3 pt-1">
          {ROBOT_MOVES.map((m) => (
            <button
              key={m} type="button" onClick={() => send({ kind: "robot", move: m }, `Robot: ${ROBOT_MOVE_LABELS[m].label.toLowerCase()}`)}
              className="flex h-16 flex-col items-center justify-center rounded-[12px] bg-on-paper/[0.06] text-sm font-semibold transition-transform active:scale-95"
            >
              <span className="text-xl">{ROBOT_MOVE_LABELS[m].emoji}</span>{ROBOT_MOVE_LABELS[m].label}
            </button>
          ))}
          <button
            type="button" onClick={() => send({ kind: "robot", move: "random" }, "Robot sorpresa")}
            className="flex h-16 flex-col items-center justify-center rounded-[12px] bg-primary text-sm font-semibold transition-transform active:scale-95"
          >
            <span className="text-xl">🎲</span>Sorpresa
          </button>
        </div>
      </section>

      {/* Beat */}
      {canConfigure && (
        <section className="rounded-[16px] border border-line-strong p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Al ritmo de la música</p>
              <p className="text-sm text-muted">Las fotos cambian con el beat y la pantalla late.</p>
            </div>
            <button
              type="button" role="switch" aria-checked={beat.enabled} aria-label="Al ritmo de la música"
              onClick={() => setBeat((b) => ({ ...b, enabled: !b.enabled }))}
              className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors", beat.enabled ? "bg-primary" : "bg-surface-2")}
            >
              <span className={cn("absolute top-1 size-6 rounded-full transition-all", beat.enabled ? "left-7 bg-on-paper" : "left-1 bg-muted")} />
            </button>
          </div>
          <div className={cn("mt-4 space-y-4", !beat.enabled && "opacity-50")}>
            <div className="flex items-center gap-4">
              <span className="font-mono text-4xl tabular-nums" aria-live="polite">{beat.bpm}</span>
              <span className="eyebrow text-muted">BPM</span>
              <span
                className="ml-auto size-4 rounded-full bg-primary"
                style={beat.enabled ? { animation: `fq-beat ${60000 / beat.bpm}ms ease-out infinite`, boxShadow: "0 0 0 0 rgb(255 91 46 / .6)" } : undefined}
              />
            </div>
            <input
              type="range" min={60} max={200} value={beat.bpm} aria-label="BPM"
              onChange={(e) => setBeat((b) => ({ ...b, bpm: Number(e.target.value) }))}
              className="h-2 w-full cursor-pointer accent-[var(--primary)]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={tap} className="h-12 flex-1 rounded-full bg-paper font-semibold text-on-paper active:scale-95">Tocá al ritmo</button>
              {[100, 124, 128].map((v) => (
                <button key={v} type="button" onClick={() => setBeat((b) => ({ ...b, bpm: v }))} className="h-12 rounded-full border border-line-strong px-4 font-mono text-sm">{v}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Cambia cada</span>
              {([1, 2, 4, 8] as const).map((n) => (
                <button
                  key={n} type="button" onClick={() => setBeat((b) => ({ ...b, beatsPerPhoto: n }))}
                  className={cn("h-9 rounded-full px-3 font-mono", beat.beatsPerPhoto === n ? "bg-primary text-on-paper" : "border border-line-strong")}
                >
                  {n}
                </button>
              ))}
              <span className="text-muted">{beat.beatsPerPhoto === 1 ? "beat" : "beats"} · {(60 / beat.bpm * beat.beatsPerPhoto).toFixed(1)} s por foto</span>
            </div>
          </div>
        </section>
      )}

      {/* Pick what plays */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <p className="eyebrow text-muted">Elegí qué pasa ahora</p>
          <p className="font-mono text-xs text-faint">{items.length} aprobados</p>
        </div>
        {items.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">Cuando apruebes fotos van a aparecer acá.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button" onClick={() => setPicked(it)}
                  className={cn("relative block aspect-square w-full overflow-hidden rounded-[8px] bg-surface", it.id === live.nowId && "ring-2 ring-primary ring-offset-2 ring-offset-bg")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.thumbUrl && <img src={it.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />}
                  {it.type === "video" && <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] text-white">▶</span>}
                  {it.id === live.pinnedId && <span className="absolute right-1 top-1 text-sm">📌</span>}
                  {it.robotMove && <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-xs" title="Con robot">🤖</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {picked && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setPicked(null)}>
          <div className="w-full rounded-t-[20px] bg-bg-elevated p-4 pb-8" style={{ animation: "fq-slide-up 300ms cubic-bezier(.2,.8,.2,1) both" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {picked.thumbUrl && <img src={picked.thumbUrl} alt="" className="size-24 rounded-[10px] object-cover" />}
              <div className="min-w-0">
                <p className="font-semibold">{picked.senderName ?? "Anónimo"}</p>
                {picked.message && <p className="mt-1 text-sm italic text-muted">“{picked.message}”</p>}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="h-14 rounded-full bg-primary font-semibold text-on-paper" onClick={() => { void send({ kind: "playNow", mediaId: picked.id }, "Pasa ahora"); setPicked(null); }}>Pasar ahora</button>
              <button type="button" className="h-14 rounded-full border border-line-strong font-semibold" onClick={() => { void send({ kind: "pin", mediaId: picked.id }, "Fijada en pantalla"); setPicked(null); }}>📌 Fijar</button>
            </div>
            {picked.type === "photo" && (
              <div className="mt-5">
                <p className="eyebrow mb-2 text-muted">🤖 Robot en esta foto</p>
                <div className="flex flex-wrap gap-1.5">
                  {([null, "random", ...ROBOT_MOVES] as const).map((m) => (
                    <button
                      key={m ?? "none"} type="button" onClick={() => void markRobot(picked, m)}
                      className={cn("h-10 rounded-full px-3 text-sm font-semibold",
                        (picked.robotMove ?? null) === m ? "bg-primary text-on-paper" : "border border-line-strong")}
                    >
                      {m === null ? "Sin robot" : m === "random" ? "🎲 Sorpresa" : `${ROBOT_MOVE_LABELS[m].emoji} ${ROBOT_MOVE_LABELS[m].label}`}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Cada vez que salga esta foto, el robot aparece haciendo eso.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4" role="status">
          <p className="rounded-full bg-paper px-5 py-3 text-sm font-semibold text-on-paper shadow-xl" style={{ animation: "fq-toast 2200ms both" }}>{toast}</p>
        </div>
      )}
    </div>
  );
}

function Big({ onClick, icon, label, accent, disabled }: { onClick: () => void; icon: string; label: string; accent?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={cn("flex h-20 flex-col items-center justify-center gap-1 border-r border-line last:border-r-0 transition-colors active:bg-surface-2 disabled:opacity-40", accent && "text-primary")}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function Moment({ onClick, icon, title, hint, hot }: { onClick: () => void; icon: string; title: string; hint: string; hot?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn("flex h-24 flex-col items-start justify-between rounded-[14px] p-4 text-left transition-transform active:scale-[0.97]",
        hot ? "bg-primary text-on-paper" : "border border-line-strong bg-bg-elevated")}
    >
      <span className="text-2xl">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={cn("block text-xs", hot ? "text-on-paper/70" : "text-muted")}>{hint}</span>
      </span>
    </button>
  );
}
