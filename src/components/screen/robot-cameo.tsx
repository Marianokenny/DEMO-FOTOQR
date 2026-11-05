"use client";

import { useEffect, useState } from "react";
import { Mascot, type MascotMood } from "@/components/brand/mascot";
import { FONT_VARS } from "./fonts";
import { ROBOT_MOVE_LABELS, type RobotMove } from "@/lib/features";

export const CAMEO_MS = 6200;

type Phase = "off" | "in" | "act" | "act2" | "out";

/** Timeline shared by every move: fly in, do the thing, react, fly away. */
const STEPS: [Phase, number][] = [["in", 60], ["act", 1000], ["act2", 2600], ["out", 5000]];

export function pickMove(move: RobotMove | "random" | string | null | undefined, allowed: readonly RobotMove[]): RobotMove {
  if (move && move !== "random" && move in ROBOT_MOVE_LABELS) return move as RobotMove;
  const pool = allowed.length ? allowed : (Object.keys(ROBOT_MOVE_LABELS) as RobotMove[]);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * The mascot drops in over a photo for a few seconds: waves, takes a picture of it, dances,
 * throws hearts or peeks from the edge. It never covers the middle of the photo.
 */
export function RobotCameo({ move, side, text }: { move: RobotMove; side: "left" | "right"; text?: string }) {
  const [phase, setPhase] = useState<Phase>("off");
  const [look, setLook] = useState({ x: side === "left" ? 0.8 : -0.8, y: -0.2 });
  useEffect(() => {
    const t = STEPS.map(([p, at]) => setTimeout(() => setPhase(p), at));
    if (move === "peek") {
      // Looks around the photo before reacting.
      t.push(
        setTimeout(() => setLook({ x: -1, y: -0.4 }), 1300),
        setTimeout(() => setLook({ x: 1, y: -0.4 }), 1900),
        setTimeout(() => setLook({ x: side === "left" ? 1 : -1, y: -0.6 }), 2500),
      );
    }
    return () => t.forEach(clearTimeout);
  }, [move, side]);

  const acting = phase === "act" || phase === "act2";
  const line = text?.trim() || ROBOT_MOVE_LABELS[move].line;
  const flash = move === "photo" && phase === "act2";

  let mood: MascotMood = "idle";
  if (move === "photo") mood = phase === "act" ? "focus" : phase === "act2" || phase === "out" ? "happy" : "idle";
  if (move === "wave") mood = phase === "act2" ? "wink" : acting ? "happy" : "idle";
  if (move === "dance") mood = acting || phase === "out" ? "happy" : "idle";
  if (move === "love") mood = acting || phase === "out" ? "love" : "idle";
  if (move === "peek") mood = phase === "act2" ? "wow" : "idle";

  // Peek rises from the bottom edge and only shows its head; the others hover in the corner.
  const peek = move === "peek";
  const hidden = phase === "off" || phase === "out";
  const offX = side === "left" ? "-40cqh" : "40cqh";
  const transform = peek
    ? `translateY(${hidden ? "100%" : "38%"}) rotate(${side === "left" ? 8 : -8}deg)`
    : hidden ? `translate(${offX}, 20cqh) rotate(${side === "left" ? -25 : 25}deg)` : "translate(0, 0) rotate(0deg)";

  const bodyAnim =
    move === "dance" && acting ? "fq-dance 0.52s ease-in-out infinite"
      : move === "love" && phase === "act2" ? "fq-jump 0.9s ease-in-out 2"
        : peek ? undefined : "fq-bob 1.6s ease-in-out infinite";

  return (
    <div className="fq-motion pointer-events-none absolute inset-0 z-30 overflow-hidden" data-testid="robot-cameo" data-move={move}>
      {flash && <div className="absolute inset-0 bg-white" style={{ animation: "fq-flash 700ms ease-out both" }} />}
      <div
        className={`absolute h-[38cqh] ${side === "left" ? "left-[3cqw]" : "right-[3cqw]"} ${peek ? "bottom-0" : "bottom-[12cqh]"}`}
        style={{
          aspectRatio: "260 / 320",
          transform,
          transition: `transform ${phase === "out" ? 900 : 850}ms cubic-bezier(.45,.05,.25,1)`,
        }}
      >
        <div className="size-full" style={{ animation: bodyAnim, transformOrigin: "50% 90%" }}>
          <div className="size-full" style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}>
            <Mascot
              mood={mood}
              wave={(move === "wave" && acting) || (move === "dance" && acting)}
              cameraUp={move === "photo" && acting}
              flash={flash}
              look={side === "right" ? { x: -look.x, y: look.y } : look}
              className="size-full drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Speech bubble, toward the middle of the screen */}
        {acting && (
          <div
            className={`absolute ${peek ? "top-[-6%]" : "top-[-4%]"} ${side === "left" ? "left-[78%] origin-bottom-left" : "right-[78%] origin-bottom-right"} whitespace-nowrap rounded-[2.4cqh] bg-[#F3ECE0] px-[2.2cqh] py-[1.2cqh] text-[3.6cqh] leading-none text-[#15120E] shadow-xl`}
            style={{ fontFamily: FONT_VARS["Instrument Serif"], animation: "fq-bubble 450ms cubic-bezier(.2,.8,.2,1) both" }}
          >
            {line}
            <span className={`absolute -bottom-[1cqh] ${side === "left" ? "left-[2.4cqh]" : "right-[2.4cqh]"} size-[2.2cqh] rotate-45 bg-[#F3ECE0]`} />
          </div>
        )}

        {/* Extras per move */}
        {move === "dance" && acting && ["♪", "♫", "♪", "♬"].map((n, i) => (
          <span
            key={i}
            className="absolute text-[5cqh] text-[#FF5B2E]"
            style={{ left: `${10 + i * 22}%`, top: "30%", ["--fq-dx" as string]: `${(i % 2 ? 1 : -1) * 4}cqh`, animation: `fq-note 1.3s ease-out ${i * 320}ms infinite` }}
          >{n}</span>
        ))}
        {move === "love" && acting && Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="absolute text-[4.5cqh]" style={{ left: `${(i * 37) % 90}%`, top: `${10 + (i % 3) * 8}%`, animation: `fq-heart 1.6s ease-out ${i * 220}ms infinite` }}>
            {["💛", "🧡", "❤️"][i % 3]}
          </span>
        ))}
        {(move === "wave" || move === "photo") && phase === "act2" && ["✨", "✨"].map((s, i) => (
          <span key={i} className="absolute text-[4cqh]" style={{ left: `${20 + i * 50}%`, top: "2%", animation: `fq-heart 1.2s ease-out ${i * 200}ms both` }}>{s}</span>
        ))}
      </div>
    </div>
  );
}
