"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Arrow, Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AuthForm({ mode, action }: {
  mode: "login" | "register";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  const isLogin = mode === "login";

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div>
        <h1 className="display text-5xl">{isLogin ? <>Hola <em>de nuevo</em></> : <>Creá tu <em>cuenta</em></>}</h1>
        <p className="mt-3 text-muted">
          {isLogin ? "Ingresá para administrar tus eventos." : "En dos minutos tenés tu primer evento listo."}
        </p>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-[10px] border border-danger/40 px-4 py-3 text-sm text-danger">{state.error}</p>
      )}
      {!isLogin && (
        <Field label="Nombre" error={err("name")}>
          <Input name="name" autoComplete="name" defaultValue={state?.values?.name} placeholder="Tu nombre" />
        </Field>
      )}
      <Field label="Email" error={err("email")}>
        <Input name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} placeholder="vos@ejemplo.com" />
      </Field>
      <Field label="Contraseña" error={err("password")} hint={isLogin ? undefined : "Mínimo 8 caracteres."}>
        <Input name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} placeholder="••••••••" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Un momento…" : isLogin ? "Ingresar" : "Crear cuenta"} {!pending && <Arrow />}
      </Button>
      <p className="text-sm text-muted">
        {isLogin ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
        <Link href={isLogin ? "/registro" : "/login"} className="font-semibold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary">
          {isLogin ? "Registrate" : "Ingresá"}
        </Link>
      </p>
    </form>
  );
}
