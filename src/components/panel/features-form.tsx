"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ROBOT_MOVE_LABELS, ROBOT_MOVES, type Features } from "@/lib/features";
import { cn } from "@/lib/cn";

/** Show features of the screen. Every change is saved on its own and reaches the screen live. */
export function FeaturesForm({ eventId, initial }: { eventId: string; initial: Features }) {
  const [f, setF] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus("saving");
    const t = setTimeout(async () => {
      const res = await fetch(`/api/events/${eventId}/features`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
      setStatus(res?.ok ? "saved" : "error");
    }, 600);
    return () => clearTimeout(t);
  }, [f, eventId]);

  const set = <K extends keyof Features>(k: K, patch: Partial<Features[K]>) => setF((p) => ({ ...p, [k]: { ...p[k], ...patch } }));
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));

  return (
    <Card>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Show en pantalla</CardTitle>
        <span className="eyebrow text-muted" aria-live="polite">
          {status === "saving" ? "Guardando…" : status === "saved" ? "Guardado" : status === "error" ? "No se pudo guardar" : "Se guarda solo"}
        </span>
      </div>
      <div className="space-y-6">
        <Group title="QR que vuelve" emoji="▦">
          <Switch checked={f.qrBreak.enabled} onChange={(enabled) => set("qrBreak", { enabled })} label="Mostrar el QR a pantalla completa" hint="Entre fotos, con un mensaje para que suban más." />
          {f.qrBreak.enabled && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cada cuántas fotos"><Input type="number" min={2} max={100} value={f.qrBreak.every} onChange={(e) => set("qrBreak", { every: num(e.target.value, 2, 100) })} /></Field>
              <Field label="Segundos"><Input type="number" min={4} max={60} value={f.qrBreak.seconds} onChange={(e) => set("qrBreak", { seconds: num(e.target.value, 4, 60) })} /></Field>
              <Field label="Mensaje"><Input maxLength={60} value={f.qrBreak.text} onChange={(e) => set("qrBreak", { text: e.target.value })} /></Field>
            </div>
          )}
        </Group>

        <Group title="Saludos como epígrafe" emoji="💬">
          <Switch checked={f.captions.enabled} onChange={(enabled) => set("captions", { enabled })} label="Mostrar el saludo del invitado debajo de la foto" hint="Los invitados lo escriben al subir. Lo ves en Moderación antes de aprobar." />
        </Group>

        <Group title="Ranking en vivo" emoji="🏁">
          <Switch checked={f.leaderboard.enabled} onChange={(enabled) => set("leaderboard", { enabled })} label="Mostrar el top 5 de los que más suben" hint="Solo cuentan los invitados que pusieron su nombre." />
          {f.leaderboard.enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cada cuántas fotos"><Input type="number" min={5} max={200} value={f.leaderboard.every} onChange={(e) => set("leaderboard", { every: num(e.target.value, 5, 200) })} /></Field>
              <Field label="Segundos"><Input type="number" min={5} max={60} value={f.leaderboard.seconds} onChange={(e) => set("leaderboard", { seconds: num(e.target.value, 5, 60) })} /></Field>
            </div>
          )}
        </Group>

        <Group title="Selfie del momento" emoji="📸">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Hora sorpresa" hint="Vacío: solo cuando la lances desde el control en vivo.">
              <Input type="time" value={f.selfie.at} onChange={(e) => set("selfie", { at: e.target.value })} />
            </Field>
            <Field label="Tiempo para sacarla">
              <Select value={f.selfie.collectSeconds} onChange={(e) => set("selfie", { collectSeconds: Number(e.target.value) })}>
                {[60, 90, 120, 180].map((s) => <option key={s} value={s}>{s / 60 >= 1 && s % 60 === 0 ? `${s / 60} min` : `${s} s`}</option>)}
              </Select>
            </Field>
            <Field label="Mensaje"><Input maxLength={60} value={f.selfie.text} onChange={(e) => set("selfie", { text: e.target.value })} /></Field>
          </div>
          <p className="text-sm text-muted">Al terminar el tiempo, la pantalla muestra un mosaico con las fotos aprobadas que llegaron. Con la aprobación automática encendida salen todas.</p>
        </Group>

        <Group title="El robot en pantalla" emoji="🤖">
          <Switch checked={f.robot.enabled} onChange={(enabled) => set("robot", { enabled })} label="Que aparezca de sorpresa sobre las fotos" hint="Las fotos que marques desde el control en vivo lo tienen siempre, aunque esto esté apagado." />
          {f.robot.enabled && (
            <Field label="Cada cuántas fotos"><Input type="number" min={2} max={50} value={f.robot.every} onChange={(e) => set("robot", { every: num(e.target.value, 2, 50) })} className="sm:max-w-40" /></Field>
          )}
          <div>
            <p className="mb-2 text-sm text-muted">Qué puede hacer cuando aparece de sorpresa</p>
            <div className="flex flex-wrap gap-1.5">
              {ROBOT_MOVES.map((m) => {
                const on = f.robot.moves.includes(m);
                return (
                  <button
                    key={m} type="button" aria-pressed={on}
                    onClick={() => set("robot", { moves: on ? (f.robot.moves.length > 1 ? f.robot.moves.filter((x) => x !== m) : f.robot.moves) : [...f.robot.moves, m] })}
                    className={cn("h-10 rounded-full px-4 text-sm font-semibold", on ? "bg-primary text-on-paper" : "border border-line-strong text-muted")}
                  >
                    {ROBOT_MOVE_LABELS[m].emoji} {ROBOT_MOVE_LABELS[m].label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Lo que dice" hint="Vacío: una frase distinta para cada movimiento (“¡Holaaa!”, “¡Qué fotón!”…).">
            <Input maxLength={40} value={f.robot.text} placeholder="Ej: ¡Felices 15, Sofi!" onChange={(e) => set("robot", { text: e.target.value })} />
          </Field>
        </Group>

        <Group title="Al ritmo de la música" emoji="🎵">
          <Switch checked={f.beat.enabled} onChange={(enabled) => set("beat", { enabled })} label="Cambiar las fotos con el beat" hint="También lo prendés y ajustás en vivo desde el control." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`BPM: ${f.beat.bpm}`}>
              <input type="range" min={60} max={200} value={f.beat.bpm} onChange={(e) => set("beat", { bpm: Number(e.target.value) })} className="h-12 w-full accent-[var(--primary)]" aria-label="BPM" />
            </Field>
            <Field label="Cambia cada">
              <Select value={f.beat.beatsPerPhoto} onChange={(e) => set("beat", { beatsPerPhoto: Number(e.target.value) as 1 | 2 | 4 | 8 })}>
                {[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n} {n === 1 ? "beat" : "beats"} ({(60 / f.beat.bpm * n).toFixed(1)} s)</option>)}
              </Select>
            </Field>
          </div>
        </Group>
      </div>
    </Card>
  );
}

function Group({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <p className="flex items-center gap-2 font-semibold"><span>{emoji}</span>{title}</p>
      {children}
    </section>
  );
}
