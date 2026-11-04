"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

export type ProjectionFormDefaults = {
  expiresAt: string; photoSeconds: number; videoMode: "full" | "capped"; videoMaxSeconds: number; videoMuted: boolean;
  transition: string; playOrder: string; showSenderName: boolean;
};

export function ProjectionSettingsForm({ action, defaults }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: ProjectionFormDefaults;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [videoMode, setVideoMode] = useState(defaults.videoMode);
  const [seconds, setSeconds] = useState(defaults.photoSeconds);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <p className="rounded-[10px] border border-danger/40 px-4 py-3 text-sm text-danger">{state.error}</p>}

      <Field label={`Cada foto se muestra ${seconds} segundos`}>
        <input
          type="range" name="photoSeconds" min={3} max={30} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Videos">
          <Select name="videoMode" value={videoMode} onChange={(e) => setVideoMode(e.target.value as "full" | "capped")}>
            <option value="full">Se reproducen completos</option>
            <option value="capped">Se cortan a un máximo</option>
          </Select>
        </Field>
        <Field label="Máximo por video (seg)" hint={videoMode === "full" ? "Solo se usa si elegís cortar." : undefined}>
          <Input type="number" name="videoMaxSeconds" min={5} max={300} defaultValue={defaults.videoMaxSeconds} disabled={videoMode === "full"} />
        </Field>
        <Field label="Orden">
          <Select name="playOrder" defaultValue={defaults.playOrder}>
            <option value="newest_first">Lo nuevo primero</option>
            <option value="chronological">Por llegada</option>
            <option value="random">Aleatorio</option>
          </Select>
        </Field>
        <Field label="Transición">
          <Select name="transition" defaultValue={defaults.transition}>
            <option value="fade">Fundido</option>
            <option value="slide">Deslizar</option>
            <option value="zoom">Acercamiento</option>
          </Select>
        </Field>
      </div>
      {videoMode === "full" && <input type="hidden" name="videoMaxSeconds" value={defaults.videoMaxSeconds} />}

      <div className="space-y-3">
        <Switch name="videoMuted" defaultChecked={!defaults.videoMuted} label="Videos con sonido" hint="La primera vez, hacé clic en la pantalla para habilitar el audio." />
        <Switch name="showSenderName" defaultChecked={defaults.showSenderName} label="Mostrar el nombre de quien la envió" />
      </div>

      <Field label="La proyección se apaga sola el" hint="Hora de Argentina. Vacío = no se apaga sola.">
        <Input type="datetime-local" name="expiresAt" defaultValue={defaults.expiresAt} />
      </Field>

      <div className="flex justify-end border-t border-line pt-6">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : state?.values?.saved ? "Guardado ✓" : "Guardar configuración"}</Button>
      </div>
    </form>
  );
}
