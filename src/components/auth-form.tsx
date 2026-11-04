"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AuthForm({ mode, action }: {
  mode: "login" | "register";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  const isLogin = mode === "login";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold">{isLogin ? "Bienvenido de nuevo" : "Creá tu cuenta"}</h1>
        <p className="text-sm text-muted">
          {isLogin ? "Ingresá para administrar tus eventos." : "Empezá a recibir las fotos de tus invitados en minutos."}
        </p>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
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
        {pending ? "Un momento…" : isLogin ? "Ingresar" : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-muted">
        {isLogin ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
        <Link href={isLogin ? "/registro" : "/login"} className="font-semibold text-violet-300 hover:text-violet-200">
          {isLogin ? "Registrate" : "Ingresá"}
        </Link>
      </p>
    </form>
  );
}
