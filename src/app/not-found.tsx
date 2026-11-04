import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="bg-glow grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-gradient text-6xl font-extrabold">404</p>
        <h1 className="mt-3 text-xl font-semibold">No encontramos esta página</h1>
        <p className="mt-1 text-sm text-muted">Puede que el enlace sea incorrecto o que no tengas acceso.</p>
        <ButtonLink href="/" className="mt-6">Volver al inicio</ButtonLink>
      </div>
    </main>
  );
}
