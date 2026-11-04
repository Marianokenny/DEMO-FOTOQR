"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LinkExpiryForm({ action, defaultValue }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <Field label="Los invitados pueden subir hasta" error={state?.fieldErrors?.expiresAt?.[0]} hint="Hora de Argentina. Vacío = sin vencimiento.">
          <Input type="datetime-local" name="expiresAt" defaultValue={defaultValue} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="mb-7">
        {pending ? "Guardando…" : state?.values?.saved ? "Guardado ✓" : "Guardar"}
      </Button>
    </form>
  );
}
