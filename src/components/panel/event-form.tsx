"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Arrow, Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/lib/validation";

const SWATCHES = ["#FF5B2E", "#E8B04B", "#D94F8A", "#7A5CFA", "#2FA38A", "#3E7BFA", "#F3ECE0"];

export type EventFormDefaults = {
  name: string; type: string; date: string; venue: string; brandColor: string; storageDays: string;
};

export function EventForm({ action, defaults, submitLabel }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Partial<EventFormDefaults>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = { ...defaults, ...state?.values };
  const [color, setColor] = useState(v.brandColor || "#FF5B2E");
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nombre del evento" error={err("name")}>
            <Input name="name" defaultValue={v.name} placeholder="Ej: Los 15 de Sofi" />
          </Field>
        </div>
        <Field label="Tipo de evento" error={err("type")}>
          <Select name="type" defaultValue={v.type || "quince"}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
          </Select>
        </Field>
        <Field label="Fecha y hora" error={err("date")} hint="Hora de Argentina.">
          <Input name="date" type="datetime-local" defaultValue={v.date} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Lugar (opcional)" error={err("venue")}>
            <Input name="venue" defaultValue={v.venue} placeholder="Ej: Salón Las Rosas, Córdoba" />
          </Field>
        </div>
        <Field label="Color del evento" error={err("brandColor")} hint="Se usa en la página de invitados y en la proyección.">
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s} type="button" onClick={() => setColor(s)} aria-label={`Color ${s}`}
                className={`size-8 rounded-full border-2 transition ${color.toLowerCase() === s.toLowerCase() ? "scale-110 border-paper ring-2 ring-bg" : "border-transparent"}`}
                style={{ background: s }}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-full border-0 bg-transparent" aria-label="Elegir otro color" />
            <input type="hidden" name="brandColor" value={color} />
          </div>
        </Field>
        <Field label="Guardar fotos durante" error={err("storageDays")} hint="Días después del evento. Luego se borran solas.">
          <Select name="storageDays" defaultValue={v.storageDays || "30"}>
            {[7, 15, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} días</option>)}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end border-t border-line pt-6">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Guardando…" : submitLabel} {!pending && <Arrow />}</Button>
      </div>
    </form>
  );
}
