"use client";

import { useState, useTransition } from "react";
import { toggleProjectionAction } from "@/app/actions/projection";
import { cn } from "@/lib/cn";

export function ProjectionToggle({ eventId, enabled, expired }: { eventId: string; enabled: boolean; expired: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <button
      type="button" disabled={pending}
      onClick={() => start(async () => { setOn(!on); await toggleProjectionAction(eventId, !on); })}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-[14px] border p-5 text-left transition-colors",
        on && !expired ? "border-success/50 bg-success/10" : "border-line-strong",
      )}
    >
      <span>
        <span className="eyebrow block text-muted">Estado</span>
        <span className="display mt-1 block text-4xl">{on && !expired ? <>Proyección <em className="text-success">encendida</em></> : expired ? "Proyección vencida" : "Proyección apagada"}</span>
        <span className="mt-1 block text-sm text-muted">{on ? "La pantalla muestra lo aprobado en vivo." : "La pantalla muestra solo el mensaje de espera."}</span>
      </span>
      <span className={cn("relative h-9 w-16 shrink-0 rounded-full transition-colors", on ? "bg-success" : "bg-surface-2")}>
        <span className={cn("absolute top-1 size-7 rounded-full transition-transform", on ? "translate-x-8 bg-on-paper" : "translate-x-1 bg-muted")} />
      </span>
    </button>
  );
}
