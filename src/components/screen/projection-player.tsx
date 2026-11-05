"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Appearance } from "@/lib/appearance";
import { beatPhotoMs } from "@/lib/features";
import type { ScreenItem, ScreenState } from "@/lib/projection";
import type { ScreenCommand } from "@/lib/realtime";
import { Mascot } from "@/components/brand/mascot";
import { FONT_VARS } from "./fonts";
import { Caption, Leaderboard, Mosaic, QrBreak, SelfieCall, WinnerReveal, type MosaicItem, type Overlay } from "./overlays";
import { Playlist } from "./playlist";
import { CAMEO_MS, pickMove, RobotCameo } from "./robot-cameo";
import type { RobotMove } from "@/lib/features";

const FULL_REFRESH_MS = 15 * 60 * 1000; // renews signed URLs long before they expire
const LOAD_TIMEOUT_MS = 10_000;
const TRANSITION_MS = 1100;

type Slot = { item: ScreenItem; key: number } | null;

export { FONT_VARS } from "./fonts";

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
          <div className="h-[26cqh]" style={{ aspectRatio: "260 / 320", animation: "fq-hover 2.2s ease-in-out infinite" }} aria-hidden>
            <Mascot className="size-full drop-shadow-2xl" />
          </div>
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

function MediaView({ slot, active, appearance, settings, features, audio, transitionMs, onEnded }: {
  slot: NonNullable<Slot>; active: boolean; appearance: Appearance; settings: ScreenState["settings"]; features: ScreenState["features"];
  audio: boolean; transitionMs: number; onEnded: () => void;
}) {
  const { item } = slot;
  const videoRef = useRef<HTMLVideoElement>(null);
  const fit = appearance.media.fit;
  const beat = features.beat.enabled;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!active) { v.pause(); return; }
    v.currentTime = 0;
    v.muted = settings.videoMuted || !audio;
    v.play().catch(() => { v.muted = true; v.play().catch(() => onEnded()); });
  }, [active, audio, settings.videoMuted, onEnded]);

  const transition = beat ? "zoom" : settings.transition;
  const enter = transition === "slide" ? (active ? "translate-x-0" : "translate-x-[6%]") : transition === "zoom" ? (active ? "scale-100" : "scale-110") : "";
  const blurSrc = item.type === "photo" ? item.url : item.posterUrl;
  const showSender = settings.showSenderName && !!item.senderName;
  const photoSeconds = beat ? beatPhotoMs(features.beat) / 1000 : settings.photoSeconds;

  return (
    <div
      className={`absolute inset-0 transition-[opacity,transform] ease-out ${enter}`}
      style={{ opacity: active ? 1 : 0, transitionDuration: `${transitionMs}ms` }}
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
            transitionDuration: active ? `${photoSeconds + 2}s` : "0s",
          }}
        />
      ) : (
        <video ref={videoRef} src={item.url} poster={item.posterUrl ?? undefined} playsInline preload="auto" onEnded={onEnded} className="absolute inset-0 size-full" style={{ objectFit: fit }} />
      )}
      {active && features.captions.enabled && item.message && <Caption text={item.message} appearance={appearance} raised={showSender} />}
      {showSender && <SenderTag name={item.senderName!} appearance={appearance} />}
    </div>
  );
}

const post = (url: string, body?: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);

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
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const advancing = useRef(false);
  const keyCounter = useRef(0);
  const shownCount = useRef(0);
  const paused = useRef(initial.live.paused);
  const pinned = useRef<string | null>(initial.live.pinnedId);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [cameo, setCameo] = useState<{ move: RobotMove; side: "left" | "right"; key: number } | null>(null);
  const cameoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const overlayRef = useRef<Overlay | null>(null);
  const [audio, setAudio] = useState(false);
  const [hint, setHint] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [online, setOnline] = useState(true);

  const current = slots[activeIdx];
  const showing = state.on && playlist.current.size > 0 && current;
  const features = state.features;
  const transitionMs = features.beat.enabled ? 260 : TRANSITION_MS;

  const report = useCallback((nowId: string | null) => {
    void post(`/api/screen/${token}/now`, { nowId, nextId: pinned.current ? null : playlist.current.peek()?.id ?? null });
  }, [token]);

  const clearTimers = () => { clearTimeout(timer.current); clearTimeout(watchdog.current); };

  /** The mascot drops in over the photo on screen. */
  const playCameo = useCallback((move: string | null | undefined, delayMs = 0) => {
    cameoTimers.current.forEach(clearTimeout);
    const f = stateRef.current.features;
    const pos = stateRef.current.appearance.sender.position;
    const side: "left" | "right" = pos === "bottom-right" ? "left" : pos === "bottom-left" ? "right" : Math.random() < 0.5 ? "left" : "right";
    const key = Date.now();
    cameoTimers.current = [
      setTimeout(() => setCameo({ move: pickMove(move, f.robot.moves), side, key }), delayMs),
      setTimeout(() => setCameo((c) => (c?.key === key ? null : c)), delayMs + CAMEO_MS),
    ];
  }, []);

  /** Marked photos always get the robot; the rest get a surprise visit every few photos. */
  const maybeCameo = useCallback((item: ScreenItem) => {
    if (item.type !== "photo" || overlayRef.current) return;
    const f = stateRef.current.features.robot;
    if (item.robot) return playCameo(item.robot, 700);
    if (f.enabled && shownCount.current % f.every === Math.floor(f.every / 2)) playCameo("random", 900);
  }, [playCameo]);

  const scheduleFor = useCallback((item: ScreenItem, advance: () => void) => {
    clearTimers();
    if (paused.current || pinned.current) return; // the organizer holds this one
    const s = stateRef.current.settings;
    const f = stateRef.current.features;
    const photoMs = f.beat.enabled ? beatPhotoMs(f.beat) : s.photoSeconds * 1000;
    if (item.type === "photo") {
      timer.current = setTimeout(advance, photoMs);
    } else if (s.videoMode === "capped") {
      timer.current = setTimeout(advance, Math.min(s.videoMaxSeconds * 1000, item.durationMs ?? Infinity));
    }
    // Safety net: never get stuck on one item (a frozen video, a lost "ended" event).
    const expected = item.type === "photo" ? photoMs : (item.durationMs ?? 60_000);
    watchdog.current = setTimeout(advance, expected + 15_000);
  }, []);

  const showItem = useCallback(async (next: ScreenItem): Promise<boolean> => {
    try {
      await preload(next);
    } catch {
      return false;
    }
    const target = activeRef.current === 0 ? 1 : 0;
    const nextSlots: [Slot, Slot] = [...slotsRef.current] as [Slot, Slot];
    nextSlots[target] = { item: next, key: ++keyCounter.current };
    slotsRef.current = nextSlots;
    setSlots(nextSlots);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    activeRef.current = target;
    setActiveIdx(target);
    shownCount.current += 1;
    report(next.id);
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
    return true;
  }, [report]);

  const endOverlay = useCallback(() => {
    clearTimeout(overlayTimer.current);
    overlayRef.current = null;
    setOverlay(null);
  }, []);

  const openOverlay = useCallback((o: Overlay, then: () => void) => {
    clearTimers();
    clearTimeout(overlayTimer.current);
    overlayRef.current = o;
    setOverlay(o);
    overlayTimer.current = setTimeout(() => { endOverlay(); then(); }, Math.max(0, o.until - Date.now()));
  }, [endOverlay]);

  const advance = useCallback(async () => {
    if (advancing.current || overlayRef.current) return;
    advancing.current = true;
    try {
      const pl = playlist.current;
      if (!stateRef.current.on || pl.size === 0) {
        slotsRef.current = [null, null];
        setSlots([null, null]);
        report(null);
        return;
      }
      // Breaks between photos: the QR call to action and the live ranking.
      const f = stateRef.current.features;
      const n = shownCount.current;
      if (n > 0 && !pinned.current && !paused.current) {
        if (f.qrBreak.enabled && stateRef.current.uploadUrl && n % f.qrBreak.every === 0 && !breakShownAt.current.has(`qr${n}`)) {
          breakShownAt.current.add(`qr${n}`);
          openOverlay({ kind: "qr", until: Date.now() + f.qrBreak.seconds * 1000 }, () => void advanceRef.current());
          return;
        }
        if (f.leaderboard.enabled && stateRef.current.leaderboard.length > 0 && n % f.leaderboard.every === 0 && !breakShownAt.current.has(`lb${n}`)) {
          breakShownAt.current.add(`lb${n}`);
          openOverlay({ kind: "leaderboard", until: Date.now() + f.leaderboard.seconds * 1000 }, () => void advanceRef.current());
          return;
        }
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
          shownCount.current += 1;
          return;
        }
        if (await showItem(next)) {
          scheduleFor(next, () => void advanceRef.current());
          maybeCameo(next);
          return;
        }
      }
    } finally {
      advancing.current = false;
    }
  }, [scheduleFor, showItem, openOverlay, report, maybeCameo]);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const breakShownAt = useRef(new Set<string>());

  const applyState = useCallback((next: ScreenState) => {
    const wasEmpty = playlist.current.size === 0 || !stateRef.current.on;
    const prevBeat = stateRef.current.features.beat;
    const beatChanged = prevBeat.enabled !== next.features.beat.enabled || prevBeat.bpm !== next.features.beat.bpm || prevBeat.beatsPerPhoto !== next.features.beat.beatsPerPhoto;
    stateRef.current = next;
    playlist.current.order = next.settings.playOrder;
    playlist.current.sync(next.on ? next.items : []);
    setState(next);
    const showingId = slotsRef.current[activeRef.current]?.item.id;
    if (!next.on || playlist.current.size === 0) {
      clearTimers();
      slotsRef.current = [null, null];
      setSlots([null, null]);
    } else if (wasEmpty || (showingId && !playlist.current.has(showingId)) || !showingId) {
      void advanceRef.current();
    } else if (beatChanged && !overlayRef.current) {
      // New tempo: re-time the photo on screen right away instead of waiting for its old timer.
      const cur = slotsRef.current[activeRef.current]?.item;
      if (cur?.type === "photo") scheduleFor(cur, () => void advanceRef.current());
    }
  }, [scheduleFor]);

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

  const startSelfie = useCallback((text: string, startedAt: number, endsAt: number) => {
    endOverlay();
    openOverlay({ kind: "selfie", text, startedAt, until: endsAt }, async () => {
      // Give the last uploads a moment to be processed, then show what arrived.
      await new Promise((r) => setTimeout(r, 4000));
      const res = await fetch(`/api/screen/${token}/selfie`, { cache: "no-store" }).catch(() => null);
      const items: MosaicItem[] = res?.ok ? (await res.json()).items : [];
      if (items.length) openOverlay({ kind: "mosaic", items, until: Date.now() + Math.min(40, 12 + items.length) * 1000 }, () => void advanceRef.current());
      else void advanceRef.current();
    });
  }, [token, openOverlay, endOverlay]);

  const runCommand = useCallback((c: ScreenCommand) => {
    const pl = playlist.current;
    switch (c.kind) {
      case "playNow":
      case "pin":
        if (c.kind === "pin") pinned.current = c.mediaId;
        if (pl.playNext(c.mediaId)) { endOverlay(); clearTimers(); void advanceRef.current(); }
        break;
      case "unpin":
        pinned.current = null;
        void advanceRef.current();
        break;
      case "skip":
        endOverlay();
        clearTimers();
        void advanceRef.current();
        break;
      case "pause":
        paused.current = true;
        clearTimers();
        report(slotsRef.current[activeRef.current]?.item.id ?? null);
        break;
      case "resume":
        paused.current = false;
        void advanceRef.current();
        break;
      case "qr":
        openOverlay({ kind: "qr", until: Date.now() + stateRef.current.features.qrBreak.seconds * 1000 }, () => void advanceRef.current());
        break;
      case "leaderboard":
        openOverlay({ kind: "leaderboard", until: Date.now() + stateRef.current.features.leaderboard.seconds * 1000 }, () => void advanceRef.current());
        break;
      case "winner":
        openOverlay({ kind: "winner", winner: c.winner, until: Date.now() + 25_000 }, () => void advanceRef.current());
        break;
      case "selfie":
        startSelfie(c.text, Date.parse(c.startedAt), Date.parse(c.endsAt));
        break;
      case "robot":
        if (!overlayRef.current) playCameo(c.move);
        break;
      case "robotMark":
        playlist.current.setRobot(c.mediaId, c.move);
        if (c.move && slotsRef.current[activeRef.current]?.item.id === c.mediaId && !overlayRef.current) playCameo(c.move);
        break;
    }
  }, [openOverlay, endOverlay, startSelfie, report, playCameo]);

  // First start (and resume a selfie moment that is still running).
  useEffect(() => {
    playlist.current.sync(initial.on ? initial.items : []);
    if (initial.live.pinnedId) playlist.current.playNext(initial.live.pinnedId);
    const sf = initial.live.selfie;
    if (sf && Date.parse(sf.endsAt) > Date.now()) startSelfie(initial.features.selfie.text, Date.parse(sf.startedAt), Date.parse(sf.endsAt));
    else void advanceRef.current();
    return () => { clearTimers(); clearTimeout(overlayTimer.current); cameoTimers.current.forEach(clearTimeout); };
  }, [initial, startSelfie]);

  // Live channel + periodic full refresh.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let hadError = false;
    const es = new EventSource(`/api/screen/${token}/stream`);
    es.onopen = () => { setOnline(true); if (hadError) { hadError = false; void refresh(); } };
    es.onerror = () => { hadError = true; setOnline(false); };
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "control") return runCommand(msg.command);
      if (msg.type === "media.removed") {
        playlist.current.remove(msg.mediaId);
        if (pinned.current === msg.mediaId) pinned.current = null;
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
  }, [token, refresh, applyState, runCommand]);

  // Scheduled surprise selfie: ask the server once a minute (it fires only once).
  const selfieAt = features.selfie.at;
  useEffect(() => {
    if (!selfieAt) return;
    const check = () => void post(`/api/screen/${token}/selfie`);
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [token, selfieAt]);

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

  const onEnded = useCallback(() => {
    if (pinned.current || paused.current) {
      // Hold the video: replay it from the start.
      const v = document.querySelector<HTMLVideoElement>("main video");
      if (v && pinned.current) { v.currentTime = 0; void v.play().catch(() => {}); }
      return;
    }
    void advanceRef.current();
  }, []);

  const beatMs = 60_000 / features.beat.bpm;

  return (
    <main className={`fixed inset-0 overflow-hidden bg-black select-none [container-type:size] ${cursorHidden ? "cursor-none" : ""}`}>
      <Backdrop appearance={state.appearance} assets={state.assets} />
      <div
        className="absolute inset-0"
        style={features.beat.enabled && showing && !overlay ? { animation: `fq-beat ${beatMs}ms cubic-bezier(.2,.8,.2,1) infinite` } : undefined}
        data-testid="media-layer"
      >
        {slots.map((slot, i) => slot && (
          <MediaView
            key={slot.key} slot={slot} active={i === activeIdx && !!showing && !overlay} appearance={state.appearance}
            settings={state.settings} features={features} audio={audio} transitionMs={transitionMs} onEnded={onEnded}
          />
        ))}
      </div>
      {cameo && showing && !overlay && <RobotCameo key={cameo.key} move={cameo.move} side={cameo.side} text={features.robot.text} />}
      {!showing && !overlay && <WaitingScreen appearance={state.appearance} event={state.event} uploadUrl={state.uploadUrl} reason={state.reason} />}
      {overlay?.kind === "qr" && <QrBreak key={overlay.until} text={features.qrBreak.text} uploadUrl={state.uploadUrl} eventName={state.event.name} appearance={state.appearance} until={overlay.until} />}
      {overlay?.kind === "leaderboard" && <Leaderboard key={overlay.until} rows={state.leaderboard} until={overlay.until} />}
      {overlay?.kind === "winner" && <WinnerReveal key={overlay.until} winner={overlay.winner} until={overlay.until} />}
      {overlay?.kind === "selfie" && <SelfieCall key={overlay.until} text={overlay.text} until={overlay.until} uploadUrl={state.uploadUrl} appearance={state.appearance} />}
      {overlay?.kind === "mosaic" && <Mosaic key={overlay.until} items={overlay.items} until={overlay.until} />}
      {hint && (
        <div className="absolute left-1/2 top-[3cqh] -translate-x-1/2 rounded-full bg-black/70 px-5 py-2.5 text-sm text-white">
          Hacé clic para activar el sonido y apretá <kbd className="rounded bg-white/20 px-1.5 font-mono">F</kbd> para pantalla completa
        </div>
      )}
      {!online && <div className="absolute right-[1.5cqh] top-[1.5cqh] size-[1.2cqh] rounded-full bg-amber-400/80" title="Reconectando" />}
    </main>
  );
}
