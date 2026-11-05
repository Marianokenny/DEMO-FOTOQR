"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mascot, type MascotMood } from "./mascot";

type Act = "idle" | "wave" | "photo" | "dance" | "love" | "wink" | "jump";

const LINES: Partial<Record<Act, string>> = {
  wave: "¡Hola! 👋",
  photo: "¡Sonreí! 📸",
  dance: "¡A bailar!",
  love: "¡Me encanta!",
  wink: "Escaneá y listo 😉",
};
const ROUTINE: Act[] = ["photo", "dance", "wink", "love", "jump", "photo", "wave"];
const SHOTS = [
  { bg: "#FF5B2E", emoji: "🎉", who: "Tía Marta" },
  { bg: "#15120E", emoji: "💃", who: "Juan" },
  { bg: "#E9DCC6", emoji: "🥂", who: "Los primos" },
  { bg: "#FFB199", emoji: "🎂", who: "Sofi 💛" },
  { bg: "#2E2924", emoji: "🕺", who: "Abuelo Tito" },
];

/**
 * The landing mascot: eyes follow the pointer, it waves when you get close, and every few seconds
 * it does something (dances, winks, throws hearts, takes a photo that lands as a polaroid).
 * Tap it and it takes a photo.
 */
export function HeroRobot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [act, setAct] = useState<Act>("idle");
  const [stage, setStage] = useState(0); // sub-step inside the photo act
  const [shots, setShots] = useState<{ id: number; shot: (typeof SHOTS)[number]; rot: number; tx: number; ty: number }[]>([]);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shotCount = useRef(0);

  const play = useCallback((a: Act) => {
    if (busy.current) return;
    busy.current = true;
    timers.current.forEach(clearTimeout);
    setAct(a);
    setStage(0);
    const len = a === "photo" ? 2600 : a === "dance" ? 2600 : a === "jump" ? 1300 : 2200;
    const t: ReturnType<typeof setTimeout>[] = [];
    if (a === "photo") {
      t.push(setTimeout(() => setStage(1), 700)); // flash
      t.push(setTimeout(() => {
        setStage(2);
        const n = shotCount.current++;
        setShots((s) => [...s.slice(-2), { id: n, shot: SHOTS[n % SHOTS.length], rot: ((n * 37) % 22) - 11, tx: -40 + ((n * 23) % 50), ty: 80 + ((n * 29) % 25) }]);
      }, 900));
    }
    t.push(setTimeout(() => { setAct("idle"); setStage(0); busy.current = false; }, len));
    timers.current = t;
  }, []);

  // Eyes follow the pointer anywhere on the page.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.4;
      setLook({ x: (e.clientX - cx) / (window.innerWidth / 2), y: (e.clientY - cy) / (window.innerHeight / 2) });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Says hello, then keeps busy.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const hello = setTimeout(() => play("wave"), 700);
    const loop = setInterval(() => play(ROUTINE[i++ % ROUTINE.length]), 4200);
    return () => { clearTimeout(hello); clearInterval(loop); timers.current.forEach(clearTimeout); };
  }, [play]);

  let mood: MascotMood = "idle";
  if (act === "wave" || act === "dance" || act === "jump") mood = "happy";
  if (act === "love") mood = "love";
  if (act === "wink") mood = "wink";
  if (act === "photo") mood = stage === 0 ? "focus" : "happy";

  const body =
    act === "dance" ? "fq-dance 0.52s ease-in-out infinite"
      : act === "jump" ? "fq-jump 1.2s ease-in-out"
        : "fq-hover 2.2s ease-in-out infinite";
  const line = LINES[act];

  return (
    <div className={className}>
    <div ref={ref} className="fq-motion relative select-none">
      {/* polaroids it has taken */}
      <div className="pointer-events-none absolute left-[72%] top-[60%] z-0" aria-hidden>
        {shots.map(({ id, shot, rot, tx, ty }) => (
          <div
            key={id}
            className="absolute left-0 top-0 w-[72px] rounded-[4px] bg-[#FFFDF8] p-[5px] pb-[18px] shadow-xl"
            style={{ ["--fq-tx" as string]: `${tx}px`, ["--fq-ty" as string]: `${ty}px`, ["--fq-rot" as string]: `${rot}deg`, ["--fq-px" as string]: "10px", animation: "fq-polaroid 900ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            <div className="grid aspect-square place-items-center text-2xl" style={{ background: shot.bg }}>{shot.emoji}</div>
            <p className="absolute inset-x-0 bottom-[4px] truncate text-center font-mono text-[9px] uppercase tracking-wider text-[#15120E]">{shot.who}</p>
          </div>
        ))}
      </div>

      <button
        type="button" aria-label="Robot de FOTOSQR: tocalo y saca una foto"
        onClick={() => { busy.current = false; play("photo"); }}
        onPointerEnter={() => play("wave")}
        className="relative z-10 block w-full cursor-pointer"
        style={{ aspectRatio: "260 / 320" }}
      >
        <div className="size-full" style={{ animation: body, transformOrigin: "50% 90%" }}>
          <Mascot
            mood={mood} look={act === "idle" || act === "wave" ? look : undefined}
            wave={act === "wave" || act === "dance"} cameraUp={act === "photo"} flash={act === "photo" && stage >= 1}
            className="size-full drop-shadow-2xl"
          />
        </div>
        {act === "dance" && ["♪", "♫", "♬"].map((n, i) => (
          <span key={i} className="absolute text-3xl text-primary" style={{ left: `${15 + i * 30}%`, top: "20%", ["--fq-dx" as string]: `${(i % 2 ? 1 : -1) * 18}px`, animation: `fq-note 1.2s ease-out ${i * 300}ms infinite` }}>{n}</span>
        ))}
        {act === "love" && Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="absolute text-2xl" style={{ left: `${(i * 31) % 85}%`, top: `${8 + (i % 3) * 8}%`, animation: `fq-heart 1.5s ease-out ${i * 200}ms both` }}>{["💛", "🧡", "❤️"][i % 3]}</span>
        ))}
      </button>

      {line && (
        <div
          key={act}
          className="absolute -top-2 right-[72%] z-20 origin-bottom-right whitespace-nowrap rounded-[18px] bg-paper px-4 py-2.5 text-lg leading-none text-on-paper shadow-xl"
          style={{ fontFamily: "var(--font-instrument)", animation: "fq-bubble 400ms cubic-bezier(.2,.8,.2,1) both" }}
        >
          {line}
          <span className="absolute -bottom-1.5 right-5 size-3 rotate-45 bg-paper" />
        </div>
      )}
      {act === "photo" && stage === 1 && <div className="pointer-events-none absolute -inset-[30%] z-30 rounded-full bg-white/80 blur-2xl" style={{ animation: "fq-flash 500ms ease-out both" }} />}
    </div>
    </div>
  );
}
