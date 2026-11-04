"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Appearance } from "@/lib/appearance";
import type { ScreenItem, ScreenState } from "@/lib/projection";
import { Playlist } from "./playlist";

const FULL_REFRESH_MS = 15 * 60 * 1000; // renews signed URLs long before they expire
const LOAD_TIMEOUT_MS = 10_000;
const TRANSITION_MS = 1100;

type Slot = { item: ScreenItem; key: number } | null;

export const FONT_VARS: Record<string, string> = {
  "Instrument Serif": "var(--font-instrument)",
  "Bricolage Grotesque": "var(--font-bricolage)",
  "Playfair Display": "var(--font-playfair)",
  "Great Vibes": "var(--font-greatvibes)",
  "Bebas Neue": "var(--font-bebas)",
  Montserrat: "var(--font-montserrat)",
};

function preload(item: ScreenItem): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
    const done = () => { clearTimeout(timer); resolve(); };
    const fail = () => { clearTimeout(timer); reject(new Error("load")); };
    if (item.type === "photo") {
      const img = new Image();
      img.onload = () => img.decode().then(done, done);
      img.onerror = fail;
      img.src = item.url;
    } else {
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.oncanplay = done;
      v.onerror = fail;
      v.src = item.url;
      v.load();
    }
  });
}

/** Background + intermediate layers, shared by the live screen and the editor preview. */
export function Backdrop({ appearance, assets }: { appearance: Appearance; assets: Record<string, string> }) {
  const bg = appearance.background;
  const bgUrl = bg.assetId ? assets[bg.assetId] : null;
  return (
    <>
      <div className="absolute inset-0" style={{ background: bg.color }} />
      {bgUrl && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${bgUrl}")`, filter: `brightness(${bg.brightness})` }} />
      )}
      {appearance.layers.filter((l) => l.visible && assets[l.assetId]).map((l) => (
        <div
          key={l.id}
          className="absolute inset-0 bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("${assets[l.assetId]}")`, backgroundSize: l.fit, opacity: l.opacity,
            filter: `brightness(${l.brightness})`, mixBlendMode: l.blend as React.CSSProperties["mixBlendMode"],
          }}
        />
      ))}
    </>
  );
}

export function WaitingScreen({ appearance, event, uploadUrl, reason }: {
  appearance: Appearance; event: { name: string; color: string }; uploadUrl: string | null; reason: ScreenState["reason"];
}) {
  const w = appearance.waitingText;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!uploadUrl || !w.showQr) return setQr(null);
    QRCode.toString(uploadUrl, { type: "svg", margin: 1, color: { dark: "#15120e", light: "#ffffff" } }).then(setQr);
  }, [uploadUrl, w.showQr]);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] p-[5cqw] text-center">
      {w.enabled && (
        <p
          className="max-w-[80cqw] leading-[1.05]"
          style={{
            fontFamily: FONT_VARS[w.font], fontSize: `calc(${w.size} / 1080 * 100cqh)`, color: w.color,
            background: w.background === "transparent" ? undefined : w.background,
            padding: w.background === "transparent" ? undefined : "0.15em 0.5em", borderRadius: "0.2em",
          }}
        >
          {w.text}
        </p>
      )}
      {qr && (
        <div className="flex items-center gap-[2cqw]">
          <div className="w-[22cqh] rounded-[1.5cqh] bg-white p-[1cqh] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="text-left" style={{ color: w.color }}>
            <p className="font-mono text-[1.6cqh] uppercase tracking-[0.2em] opacity-70">Escaneá el QR</p>
            <p className="mt-[0.6cqh] text-[3.2cqh]" style={{ fontFamily: FONT_VARS["Instrument Serif"] }}>{event.name}</p>
          </div>
        </div>
      )}
      {reason === "expired" && <p className="font-mono text-[1.4cqh] uppercase tracking-[0.2em] opacity-50" style={{ color: w.color }}>La proyección terminó</p>}
    </div>
  );
}

export function SenderTag({ name, appearance }: { name: string; appearance: Appearance }) {
  const s = appearance.sender;
  const pos = { "bottom-left": "left-[3cqw]", "bottom-center": "left-1/2 -translate-x-1/2", "bottom-right": "right-[3cqw]" }[s.position];
  return (
    <div
      className={`absolute bottom-[4cqh] ${pos} rounded-full px-[1.6cqh] py-[0.8cqh] text-[2.4cqh] font-semibold shadow-lg`}
      style={{ color: s.color, background: s.background === "transparent" ? undefined : s.background }}
    >
      <span className="mr-[0.8cqh] opacity-60">📷</span>{name}
    </div>
  );
}

function MediaView({ slot, active, appearance, settings, audio, onEnded }: {
  slot: NonNullable<Slot>; active: boolean; appearance: Appearance; settings: ScreenState["settings"]; audio: boolean; onEnded: () => void;
}) {
  const { item } = slot;
  const videoRef = useRef<HTMLVideoElement>(null);
  const fit = appearance.media.fit;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!active) { v.pause(); return; }
    v.currentTime = 0;
    v.muted = settings.videoMuted || !audio;
    v.play().catch(() => { v.muted = true; v.play().catch(() => onEnded()); });
  }, [active, audio, settings.videoMuted, onEnded]);

  const transition = settings.transition;
  const enter = transition === "slide" ? (active ? "translate-x-0" : "translate-x-[6%]") : transition === "zoom" ? (active ? "scale-100" : "scale-110") : "";
  const blurSrc = item.type === "photo" ? item.url : item.posterUrl;

  return (
    <div
      className={`absolute inset-0 transition-[opacity,transform] ease-out ${enter}`}
      style={{ opacity: active ? 1 : 0, transitionDuration: `${TRANSITION_MS}ms` }}
    >
      {appearance.media.blurFill && fit === "contain" && blurSrc && (
        <div className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-[40px] brightness-50" style={{ backgroundImage: `url("${blurSrc}")` }} />
      )}
      {item.type === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url} alt=""
          className="absolute inset-0 size-full ease-linear"
          style={{
            objectFit: fit,
            transform: active ? "scale(1.04)" : "scale(1)",
            transitionProperty: "transform",
            transitionDuration: active ? `${settings.photoSeconds + 2}s` : "0s",
          }}
        />
      ) : (
        <video ref={videoRef} src={item.url} poster={item.posterUrl ?? undefined} playsInline preload="auto" onEnded={onEnded} className="absolute inset-0 size-full" style={{ objectFit: fit }} />
      )}
      {settings.showSenderName && item.senderName && <SenderTag name={item.senderName} appearance={appearance} />}
    </div>
  );
}

export function ProjectionPlayer({ token, initial }: { token: string; initial: ScreenState }) {
  const [state, setState] = useState(initial);
  const stateRef = useRef(initial);
  const playlist = useRef(new Playlist(initial.settings.playOrder));
  const [slots, setSlots] = useState<[Slot, Slot]>([null, null]);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeRef = useRef(0);
  const slotsRef = useRef<[Slot, Slot]>([null, null]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const advancing = useRef(false);
  const keyCounter = useRef(0);
  const [audio, setAudio] = useState(false);
  const [hint, setHint] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [online, setOnline] = useState(true);

  const current = slots[activeIdx];
  const showing = state.on && playlist.current.size > 0 && current;

  const scheduleFor = useCallback((item: ScreenItem, advance: () => void) => {
    clearTimeout(timer.current);
    clearTimeout(watchdog.current);
    const s = stateRef.current.settings;
    if (item.type === "photo") {
      timer.current = setTimeout(advance, s.photoSeconds * 1000);
    } else if (s.videoMode === "capped") {
      timer.current = setTimeout(advance, Math.min(s.videoMaxSeconds * 1000, item.durationMs ?? Infinity));
    }
    // Safety net: never get stuck on one item (a frozen video, a lost "ended" event).
    const expected = item.type === "photo" ? s.photoSeconds * 1000 : (item.durationMs ?? 60_000);
    watchdog.current = setTimeout(advance, expected + 15_000);
  }, []);

  const advance = useCallback(async () => {
    if (advancing.current) return;
    advancing.current = true;
    try {
      const pl = playlist.current;
      if (!stateRef.current.on || pl.size === 0) {
        slotsRef.current = [null, null];
        setSlots([null, null]);
        return;
      }
      const currentSlot = slotsRef.current[activeRef.current];
      // Up to a few tries in case an item fails to load (deleted, network hiccup).
      for (let attempt = 0; attempt < Math.min(5, pl.size); attempt++) {
        const next = pl.next();
        if (!next) return;
        if (pl.size === 1 && currentSlot?.item.id === next.id) {
          scheduleFor(next, () => void advanceRef.current());
          if (next.type === "video") {
            // Single video: replay it in place.
            const restarted: Slot = { item: next, key: ++keyCounter.current };
            const slots2: [Slot, Slot] = [...slotsRef.current] as [Slot, Slot];
            slots2[activeRef.current] = restarted;
            slotsRef.current = slots2;
            setSlots(slots2);
          }
          return;
        }
        try {
          await preload(next);
        } catch {
          continue;
        }
        const target = activeRef.current === 0 ? 1 : 0;
        const nextSlots: [Slot, Slot] = [...slotsRef.current] as [Slot, Slot];
        nextSlots[target] = { item: next, key: ++keyCounter.current };
        slotsRef.current = nextSlots;
        setSlots(nextSlots);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        activeRef.current = target;
        setActiveIdx(target);
        scheduleFor(next, () => void advanceRef.current());
        // Free the old slot after the transition so only two media elements ever exist.
        setTimeout(() => {
          const other = target === 0 ? 1 : 0;
          if (activeRef.current === target) {
            const cleaned: [Slot, Slot] = [...slotsRef.current] as [Slot, Slot];
            cleaned[other] = null;
            slotsRef.current = cleaned;
            setSlots(cleaned);
          }
        }, TRANSITION_MS + 200);
        return;
      }
    } finally {
      advancing.current = false;
    }
  }, [scheduleFor]);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const applyState = useCallback((next: ScreenState) => {
    const wasEmpty = playlist.current.size === 0 || !stateRef.current.on;
    stateRef.current = next;
    playlist.current.order = next.settings.playOrder;
    playlist.current.sync(next.on ? next.items : []);
    setState(next);
    const showingId = slotsRef.current[activeRef.current]?.item.id;
    if (!next.on || playlist.current.size === 0) {
      clearTimeout(timer.current);
      clearTimeout(watchdog.current);
      slotsRef.current = [null, null];
      setSlots([null, null]);
    } else if (wasEmpty || (showingId && !playlist.current.has(showingId)) || !showingId) {
      void advanceRef.current();
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/screen/${token}/state`, { cache: "no-store" });
      if (!res.ok) return;
      applyState(await res.json());
      setOnline(true);
    } catch {
      setOnline(false); // keep playing what we have
    }
  }, [token, applyState]);

  // First start.
  useEffect(() => {
    playlist.current.sync(initial.on ? initial.items : []);
    void advanceRef.current();
    return () => { clearTimeout(timer.current); clearTimeout(watchdog.current); };
  }, [initial]);

  // Live channel + periodic full refresh.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let hadError = false;
    const es = new EventSource(`/api/screen/${token}/stream`);
    es.onopen = () => { setOnline(true); if (hadError) { hadError = false; void refresh(); } };
    es.onerror = () => { hadError = true; setOnline(false); };
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "media.removed") {
        playlist.current.remove(msg.mediaId);
        if (slotsRef.current[activeRef.current]?.item.id === msg.mediaId) void advanceRef.current();
        if (playlist.current.size === 0) applyState({ ...stateRef.current, items: [] });
        return;
      }
      if ((msg.type === "media.updated" && msg.status === "approved") || msg.type === "settings.updated") {
        clearTimeout(debounce);
        debounce = setTimeout(refresh, 300);
      }
    };
    const every = setInterval(refresh, FULL_REFRESH_MS);
    return () => { es.close(); clearInterval(every); clearTimeout(debounce); };
  }, [token, refresh, applyState]);

  // Keep the screen awake, hide the cursor, fullscreen with F or double click, unlock audio on first click.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const requestLock = async () => {
      try { lock = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
    };
    void requestLock();
    const onVisible = () => document.visibilityState === "visible" && requestLock();
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => { setCursorHidden(false); clearTimeout(idle); idle = setTimeout(() => setCursorHidden(true), 2500); };
    const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "f") toggleFs(); };
    const onClick = () => { setAudio(true); setHint(false); };
    const hintTimer = setTimeout(() => setHint(false), 8000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dblclick", toggleFs);
    window.addEventListener("click", onClick);
    onMove();
    return () => {
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dblclick", toggleFs);
      window.removeEventListener("click", onClick);
      clearTimeout(idle);
      clearTimeout(hintTimer);
    };
  }, []);

  const onEnded = useCallback(() => void advanceRef.current(), []);

  return (
    <main className={`fixed inset-0 overflow-hidden bg-black [container-type:size] select-none ${cursorHidden ? "cursor-none" : ""}`}>
      <Backdrop appearance={state.appearance} assets={state.assets} />
      {slots.map((slot, i) => slot && (
        <MediaView key={slot.key} slot={slot} active={i === activeIdx && !!showing} appearance={state.appearance} settings={state.settings} audio={audio} onEnded={onEnded} />
      ))}
      {!showing && <WaitingScreen appearance={state.appearance} event={state.event} uploadUrl={state.uploadUrl} reason={state.reason} />}
      {hint && (
        <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2 rounded-full bg-black/70 px-5 py-2.5 text-sm text-white">
          Hacé clic para activar el sonido y apretá <kbd className="rounded bg-white/20 px-1.5 font-mono">F</kbd> para pantalla completa
        </div>
      )}
      {!online && <div className="absolute right-[1.5cqh] top-[1.5cqh] size-[1.2cqh] rounded-full bg-amber-400/80" title="Reconectando" />}
    </main>
  );
}
