"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type Limits = { allowVideos: boolean; maxPhotoMb: number; maxVideoMb: number; maxVideoSeconds: number; maxFilesPerGuest: number };

export function UploadLimitsForm({ action, defaults }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: Limits;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  return (
    <form action={formAction} className="space-y-5">
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[10px] border border-line-strong px-4 py-3">
        <span>
          <span className="block font-medium">Permitir videos</span>
          <span className="text-sm text-muted">Si lo apagás, los invitados solo pueden subir fotos.</span>
        </span>
        <input type="checkbox" name="allowVideos" defaultChecked={defaults.allowVideos} className="peer sr-only" />
        <span className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-muted after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-on-paper" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Peso máx. por foto (MB)" error={err("maxPhotoMb")}>
          <Input type="number" name="maxPhotoMb" min={1} max={50} defaultValue={defaults.maxPhotoMb} />
        </Field>
        <Field label="Peso máx. por video (MB)" error={err("maxVideoMb")}>
          <Input type="number" name="maxVideoMb" min={5} max={1024} defaultValue={defaults.maxVideoMb} />
        </Field>
        <Field label="Duración máx. de video (seg)" error={err("maxVideoSeconds")}>
          <Input type="number" name="maxVideoSeconds" min={5} max={300} defaultValue={defaults.maxVideoSeconds} />
        </Field>
        <Field label="Archivos por invitado" error={err("maxFilesPerGuest")}>
          <Input type="number" name="maxFilesPerGuest" min={1} max={500} defaultValue={defaults.maxFilesPerGuest} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Guardando…" : state?.values?.saved ? "Guardado ✓" : "Guardar límites"}
        </Button>
      </div>
    </form>
  );
}
