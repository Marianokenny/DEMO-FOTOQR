import { Arrow, ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="display mt-4 text-6xl">Esta página <em>no está</em></h1>
        <p className="mt-3 text-muted">Puede que el enlace sea incorrecto o que no tengas acceso.</p>
        <ButtonLink href="/" className="mt-8">Volver al inicio <Arrow /></ButtonLink>
      </div>
    </main>
  );
}
