"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import type { Appearance } from "@/lib/appearance";
import { Mascot } from "@/components/brand/mascot";
import { FONT_VARS } from "./fonts";

export type Winner = { name: string; count: number; thumbUrl: string | null };
export type MosaicItem = { id: string; url: string; senderName: string | null };

export type Overlay =
  | { kind: "qr"; until: number }
  | { kind: "leaderboard"; until: number }
  | { kind: "winner"; winner: Winner | null; until: number }
  | { kind: "selfie"; text: string; startedAt: number; until: number }
  | { kind: "mosaic"; items: MosaicItem[]; until: number };

const PAPER = "#F3ECE0";
const INK = "#15120E";
const ACCENT = "#FF5B2E";

export function useQrSvg(url: string | null) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return setSvg(null);
    QRCode.toString(url, { type: "svg", margin: 1, color: { dark: INK, light: "#ffffff" } }).then(setSvg);
  }, [url]);
  return svg;
}

/** Splits text into words that appear one after the other. */
export function Words({ text, delayMs = 0, stepMs = 90, className }: { text: string; delayMs?: number; stepMs?: number; className?: string }) {
  return (
    <span className={className}>
      {text.split(/(\s+)/).map((w, i) =>
        /\s+/.test(w) ? w : (
          <span key={i} className="inline-block" style={{ animation: `fq-word 600ms cubic-bezier(.2,.8,.2,1) both`, animationDelay: `${delayMs + (i / 2) * stepMs}ms` }}>{w}</span>
        ),
      )}
    </span>
  );
}

function Progress({ until, color }: { until: number; color: string }) {
  const [total] = useState(() => Math.max(500, until - Date.now()));
  return (
    <div className="absolute inset-x-0 bottom-0 h-[0.8cqh] origin-left" style={{ background: color, animation: `fq-progress ${total}ms linear both` }} />
  );
}

function QrCard({ url, size, scanning = false, flash = false, done = false }: { url: string | null; size: string; scanning?: boolean; flash?: boolean; done?: boolean }) {
  const svg = useQrSvg(url);
  if (!svg) return null;
  return (
    <div className="relative" style={{ width: size }}>
      {scanning && (
        <div className="pointer-events-none absolute inset-x-[4%] z-10 h-[1cqh] rounded-full" style={{ background: ACCENT, boxShadow: `0 0 3cqh 1cqh ${ACCENT}`, animation: "fq-scanline 1.4s ease-in-out both" }} />
      )}
      {flash && <div className="pointer-events-none absolute inset-0 z-10 rounded-[3cqh] bg-white" style={{ animation: "fq-flash 600ms ease-out both" }} />}
      {done && (
        <span className="absolute -right-[3cqh] -top-[3cqh] z-10 grid size-[11cqh] place-items-center rounded-full text-[6cqh] font-bold" style={{ background: ACCENT, color: INK, animation: "fq-pop 600ms cubic-bezier(.2,.8,.2,1) both" }}>✓</span>
      )}
      <span className="absolute inset-0 rounded-[3cqh]" style={{ border: `0.6cqh solid ${ACCENT}`, animation: "fq-ring 1.8s ease-out infinite" }} />
      <span className="absolute inset-0 rounded-[3cqh]" style={{ border: `0.6cqh solid ${ACCENT}`, animation: "fq-ring 1.8s ease-out 0.9s infinite" }} />
      <div className="relative rounded-[3cqh] bg-white p-[2cqh] shadow-2xl [&_svg]:h-auto [&_svg]:w-full" style={{ animation: "fq-pop 900ms cubic-bezier(.2,.8,.2,1) both" }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

function Marquee({ text, color, background }: { text: string; color: string; background: string }) {
  const chunk = `${text} ✦ `.repeat(8);
  return (
    <div className="absolute inset-x-0 bottom-[0.8cqh] overflow-hidden py-[1.4cqh]" style={{ background, color }}>
      <div className="flex w-max font-mono text-[2.4cqh] uppercase tracking-[0.3em]" style={{ animation: "fq-marquee 18s linear infinite" }}>
        <span className="pr-[2cqw]">{chunk}</span><span className="pr-[2cqw]">{chunk}</span>
      </div>
    </div>
  );
}

/** "¡Subí tu foto!" break with a big QR, every few photos. */
type BuddyPhase = "off" | "enter" | "aim" | "scan" | "happy" | "leave" | "gone";
const BUDDY_STEPS: [BuddyPhase, number][] = [["enter", 700], ["aim", 2700], ["scan", 3300], ["happy", 4800], ["leave", 5900], ["gone", 7600]];

/** Timeline of the robot that flies in, photographs the QR and leaves. */
function useBuddy() {
  const [phase, setPhase] = useState<BuddyPhase>("off");
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const timers = BUDDY_STEPS.map(([p, at]) => setTimeout(() => setPhase(p), at));
    timers.push(setTimeout(() => setFlash(true), 3900), setTimeout(() => setFlash(false), 4400));
    return () => timers.forEach(clearTimeout);
  }, []);
  return { phase, flash };
}

function ScanBuddy({ phase, flash }: { phase: BuddyPhase; flash: boolean }) {
  const left = phase === "off" ? "-32cqw" : phase === "leave" || phase === "gone" ? "118cqw" : "41cqw";
  const moving = phase === "enter" || phase === "leave";
  const duration = phase === "enter" ? 2000 : phase === "leave" ? 1700 : 0;
  return (
    <div
      className="pointer-events-none absolute bottom-[9cqh] z-20 h-[60cqh]"
      style={{ left, transition: duration ? `left ${duration}ms cubic-bezier(.45,.05,.25,1)` : undefined, aspectRatio: "260 / 320" }}
      data-testid="scan-buddy"
    >
      <div className="absolute -bottom-[3cqh] left-1/2 h-[3cqh] w-[60%] -translate-x-1/2 rounded-[50%] bg-black" style={{ animation: "fq-shadow 1.6s ease-in-out infinite", filter: "blur(6px)" }} />
      <div className="size-full" style={{ animation: "fq-hover 1.6s ease-in-out infinite" }}>
        <div className="size-full transition-transform duration-500" style={{ transform: moving ? `rotate(${phase === "leave" ? 14 : 10}deg)` : "rotate(0deg)" }}>
          <Mascot mood={phase === "aim" || phase === "scan" ? "focus" : phase === "happy" || phase === "leave" ? "happy" : "idle"} cameraUp={phase === "aim" || phase === "scan"} flash={flash} className="size-full drop-shadow-2xl" />
        </div>
      </div>
      {phase === "happy" && ["💛", "✨", "🧡"].map((h, i) => (
        <span key={i} className="absolute text-[5cqh]" style={{ left: `${30 + i * 22}%`, top: "4%", animation: `fq-heart 1.4s ease-out ${i * 180}ms both` }}>{h}</span>
      ))}
    </div>
  );
}

export function QrBreak({ text, uploadUrl, eventName, appearance, until }: { text: string; uploadUrl: string | null; eventName: string; appearance: Appearance; until: number }) {
  const font = FONT_VARS[appearance.waitingText.font] ?? FONT_VARS["Instrument Serif"];
  const { phase, flash } = useBuddy();
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: PAPER, color: INK, animation: "fq-slide-up 700ms cubic-bezier(.7,0,.2,1) both" }}>
      <div className="absolute -right-[8cqw] -top-[18cqh] size-[60cqh] rounded-full" style={{ background: ACCENT, animation: "fq-pop 1s 200ms both" }} />
      <div className="relative grid h-full grid-cols-[1.2fr_1fr] items-center gap-[4cqw] px-[7cqw] pb-[8cqh]">
        <div>
          <p className="font-mono text-[2.2cqh] uppercase tracking-[0.3em] opacity-70" style={{ animation: "fq-rise 600ms 300ms both" }}>{eventName}</p>
          <p className="mt-[2cqh] max-w-[36cqw] leading-[0.95]" style={{ fontFamily: font, fontSize: "13cqh" }}>
            <Words text={text} delayMs={350} stepMs={140} />
          </p>
          <p className="mt-[3cqh] max-w-[30cqw] text-[3.4cqh]" style={{ animation: "fq-rise 700ms 1100ms both" }}>
            Escaneá el código con la cámara del celular. <strong>Sin app, sin registrarte.</strong>
          </p>
        </div>
        <div className="flex justify-center">
          <QrCard url={uploadUrl} size="52cqh" scanning={phase === "scan"} flash={flash} done={phase === "happy" || phase === "leave" || phase === "gone"} />
        </div>
      </div>
      <ScanBuddy phase={phase} flash={flash} />
      <Marquee text="Subí tu foto o video" color={PAPER} background={INK} />
      <Progress until={until} color={ACCENT} />
    </div>
  );
}

/** Top 5 guests by uploads. */
export function Leaderboard({ rows, until, title = "Los paparazzi de la noche" }: { rows: { name: string; count: number }[]; until: number; title?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="absolute inset-0 flex flex-col justify-center overflow-hidden px-[8cqw]" style={{ background: INK, color: PAPER, animation: "fq-rise 600ms both" }}>
      <p className="font-mono text-[2.2cqh] uppercase tracking-[0.3em]" style={{ color: ACCENT }}>Ranking en vivo</p>
      <h2 className="mt-[1.5cqh] text-[10cqh] leading-none" style={{ fontFamily: FONT_VARS["Instrument Serif"] }}><Words text={title} stepMs={110} /></h2>
      <ol className="mt-[5cqh] space-y-[2.2cqh]">
        {rows.map((r, i) => (
          <li key={r.name + i} className="grid grid-cols-[8cqh_1fr_auto] items-center gap-[2.5cqw]" style={{ animation: `fq-rise 600ms ${500 + i * 180}ms both` }}>
            <span className="font-mono text-[5cqh]" style={{ color: i === 0 ? ACCENT : undefined, opacity: i === 0 ? 1 : 0.55 }}>{String(i + 1).padStart(2, "0")}</span>
            <div className="relative h-[8cqh] overflow-hidden rounded-full" style={{ background: "rgb(243 236 224 / 0.08)" }}>
              <div
                className="absolute inset-y-0 left-0 origin-left rounded-full"
                style={{ width: `${Math.max(18, (r.count / max) * 100)}%`, background: i === 0 ? ACCENT : "rgb(243 236 224 / 0.22)", animation: `fq-bar 900ms cubic-bezier(.2,.8,.2,1) ${700 + i * 180}ms both` }}
              />
              <span className="relative flex h-full items-center px-[3cqh] text-[4cqh] font-semibold" style={{ color: i === 0 ? INK : PAPER }}>
                {i === 0 && <span className="mr-[1.5cqh] inline-block" style={{ animation: "fq-wiggle 1.2s ease-in-out infinite" }}>👑</span>}
                {r.name}
              </span>
            </div>
            <span className="font-mono text-[4.5cqh]">{r.count}<span className="ml-[0.8cqh] text-[2cqh] opacity-60">{r.count === 1 ? "FOTO" : "FOTOS"}</span></span>
          </li>
        ))}
      </ol>
      <Progress until={until} color={ACCENT} />
    </div>
  );
}

function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 2.5, dur: 3.5 + Math.random() * 3, size: 1 + Math.random() * 1.6,
    color: [ACCENT, PAPER, "#FFC857", "#7BD3C4"][i % 4], drift: `${(Math.random() - 0.5) * 30}cqw`, spin: `${360 + Math.random() * 720}deg`, round: i % 3 === 0,
  })), [count]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i} className="absolute top-0"
          style={{
            left: `${p.left}%`, width: `${p.size}cqh`, height: `${p.size * (p.round ? 1 : 1.8)}cqh`, background: p.color, borderRadius: p.round ? "50%" : "2px",
            animation: `fq-fall ${p.dur}s linear ${p.delay}s infinite`, ["--fq-drift" as string]: p.drift, ["--fq-spin" as string]: p.spin,
          }}
        />
      ))}
    </div>
  );
}

/** "Paparazzi de la noche" celebration. */
export function WinnerReveal({ winner, until }: { winner: Winner | null; until: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: INK, color: PAPER }}>
      <Confetti />
      <div className="relative grid h-full grid-cols-[1fr_auto] items-center gap-[5cqw] px-[8cqw]">
        <div>
          <p className="font-mono text-[2.4cqh] uppercase tracking-[0.3em]" style={{ color: ACCENT, animation: "fq-rise 600ms both" }}>🏆 Premio de la noche</p>
          <p className="mt-[2cqh] text-[8cqh] leading-none" style={{ fontFamily: FONT_VARS["Instrument Serif"], animation: "fq-rise 700ms 300ms both" }}>
            <em>Paparazzi</em> de la noche
          </p>
          {winner ? (
            <>
              <p className="mt-[4cqh] text-[16cqh] font-semibold leading-[0.9]" style={{ fontFamily: FONT_VARS["Bebas Neue"], color: ACCENT, animation: "fq-pop 1100ms cubic-bezier(.2,.8,.2,1) 1200ms both" }}>{winner.name}</p>
              <p className="mt-[2cqh] text-[4cqh]" style={{ animation: "fq-rise 700ms 2000ms both" }}>
                con <span className="font-mono">{winner.count}</span> {winner.count === 1 ? "foto" : "fotos"} en pantalla. ¡Aplausos!
              </p>
            </>
          ) : (
            <p className="mt-[4cqh] text-[5cqh]" style={{ animation: "fq-rise 700ms 1000ms both" }}>Todavía nadie con nombre subió fotos. ¡A sacar!</p>
          )}
        </div>
        {winner?.thumbUrl && (
          <div className="rotate-[4deg] bg-white p-[1.6cqh] pb-[6cqh] shadow-2xl" style={{ animation: "fq-pop 1200ms cubic-bezier(.2,.8,.2,1) 1600ms both" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={winner.thumbUrl} alt="" className="h-[55cqh] w-[42cqh] object-cover" />
          </div>
        )}
      </div>
      <Progress until={until} color={ACCENT} />
    </div>
  );
}

/** Surprise selfie: flash, big call to action and a live countdown. */
export function SelfieCall({ text, until, uploadUrl, appearance }: { text: string; until: number; uploadUrl: string | null; appearance: Appearance }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((until - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000))), 250);
    return () => clearInterval(t);
  }, [until]);
  const font = FONT_VARS[appearance.waitingText.font] ?? FONT_VARS["Instrument Serif"];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: ACCENT, color: INK }}>
      <div className="pointer-events-none absolute inset-0 bg-white" style={{ animation: "fq-flash 900ms ease-out both" }} />
      <div className="relative grid h-full grid-cols-[1.3fr_1fr] items-center gap-[4cqw] px-[7cqw]">
        <div>
          <p className="font-mono text-[2.4cqh] uppercase tracking-[0.3em]" style={{ animation: "fq-rise 500ms 500ms both" }}>📸 Selfie del momento</p>
          <p className="mt-[2cqh] leading-[0.92]" style={{ fontFamily: font, fontSize: "16cqh" }}><Words text={text} delayMs={600} stepMs={160} /></p>
          <p className="mt-[3cqh] text-[3.6cqh] font-semibold" style={{ animation: "fq-rise 600ms 1400ms both" }}>Sacala ahora y subila con el QR. Al final las mostramos todas juntas.</p>
        </div>
        <div className="flex flex-col items-center gap-[3cqh]">
          <span key={left} className="font-mono text-[20cqh] font-medium leading-none" style={{ animation: left <= 10 ? "fq-count 1s both" : undefined }}>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
          <QrCard url={uploadUrl} size="34cqh" />
        </div>
      </div>
    </div>
  );
}

/** Mosaic of the selfies that arrived. */
export function Mosaic({ items, until }: { items: MosaicItem[]; until: number }) {
  const cols = items.length <= 4 ? 2 : items.length <= 9 ? 3 : items.length <= 16 ? 4 : items.length <= 25 ? 5 : 6;
  const rows = Math.ceil(items.length / cols);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: INK, color: PAPER }}>
      <div className="absolute left-[3cqw] top-[3cqh] z-10 rounded-full px-[2.5cqh] py-[1.2cqh] font-mono text-[2.2cqh] uppercase tracking-[0.25em]" style={{ background: ACCENT, color: INK, animation: "fq-rise 500ms both" }}>
        Selfie del momento · {items.length} {items.length === 1 ? "foto" : "fotos"}
      </div>
      <div className="grid h-full gap-[1cqh] p-[1cqh]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {items.map((m, i) => (
          <div key={m.id} className="relative overflow-hidden rounded-[1cqh]" style={{ animation: `fq-pop 800ms cubic-bezier(.2,.8,.2,1) ${300 + i * 110}ms both` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt="" className="size-full object-cover" />
          </div>
        ))}
      </div>
      <Progress until={until} color={ACCENT} />
    </div>
  );
}

/** Guest greeting under the photo. */
export function Caption({ text, appearance, raised }: { text: string; appearance: Appearance; raised: boolean }) {
  const s = appearance.sender;
  const font = FONT_VARS[appearance.waitingText.font] ?? FONT_VARS["Instrument Serif"];
  return (
    <div className={`absolute inset-x-0 flex justify-center px-[8cqw] ${raised ? "bottom-[13cqh]" : "bottom-[5cqh]"}`}>
      <p
        className="max-w-[70cqw] rounded-[2cqh] px-[3cqh] py-[1.6cqh] text-center text-[5cqh] leading-[1.1] shadow-2xl"
        style={{ fontFamily: font, color: s.color, background: s.background === "transparent" ? "rgb(15 14 12 / 0.72)" : s.background, animation: "fq-rise 700ms 700ms both" }}
      >
        <span className="mr-[1cqh] opacity-60">“</span><Words text={text} delayMs={900} stepMs={70} /><span className="ml-[0.5cqh] opacity-60">”</span>
      </p>
    </div>
  );
}
