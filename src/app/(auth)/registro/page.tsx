import { registerAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
