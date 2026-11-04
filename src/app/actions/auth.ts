"use server";

import { clientInfo } from "@/lib/guest-cookie";
import { consume } from "@/lib/rate-limit";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth";
import { createSession, deleteSession, SESSION_COOKIE } from "@/lib/sessions";
import { authenticate, EmailTakenError, registerUser } from "@/lib/users";
import { loginSchema, registerSchema } from "@/lib/validation";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; values?: Record<string, string> } | undefined;

function values(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values: values(formData, ["name", "email"]) };
  }
  const { ip } = await clientInfo();
  if (!(await consume(`register:ip:${ip}`, 1, 10, 60 * 60))) {
    return { error: "Demasiadas cuentas creadas desde esta conexión. Probá más tarde.", values: values(formData, ["name", "email"]) };
  }
  try {
    const user = await registerUser(parsed.data);
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
  } catch (e) {
    if (e instanceof EmailTakenError) return { error: e.message, values: values(formData, ["name", "email"]) };
    throw e;
  }
  redirect("/panel");
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values: values(formData, ["email"]) };
  }
  // Brute-force protection: per IP and per account.
  const { ip } = await clientInfo();
  const email = parsed.data.email.toLowerCase();
  const allowed = (await consume(`login:ip:${ip}`, 1, 30, 15 * 60)) && (await consume(`login:email:${email}`, 1, 10, 15 * 60));
  if (!allowed) return { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo.", values: values(formData, ["email"]) };
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { error: "Email o contraseña incorrectos.", values: values(formData, ["email"]) };
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  redirect("/panel");
}

export async function logoutAction() {
  const store = await cookies();
  await deleteSession(store.get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  redirect("/login");
}
