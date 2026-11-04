import { CheckCircle2, QrCode, ShieldCheck, Tv } from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <main className="bg-glow min-h-dvh">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4">
        <Logo />
        {user ? (
          <ButtonLink href="/panel" size="sm">Ir al panel</ButtonLink>
        ) : (
          <div className="flex gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">Ingresar</ButtonLink>
            <ButtonLink href="/registro" size="sm">Crear cuenta</ButtonLink>
          </div>
        )}
      </header>
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 text-center sm:pt-20">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/70 px-3 py-1 text-xs font-semibold text-violet-200">
          <span className="size-1.5 rounded-full bg-fuchsia-400" /> Para 15, casamientos, cumpleaños y empresas
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          Las fotos de tus invitados, <span className="text-gradient">en vivo en la pantalla</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
          Escanean el QR, suben fotos y videos sin instalar nada, y vos decidís qué se proyecta.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href={user ? "/panel" : "/registro"} size="lg">Crear mi evento</ButtonLink>
        </div>
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {[
            { icon: QrCode, t: "QR para invitados", d: "Sin app ni registro. Desde cualquier celular." },
            { icon: ShieldCheck, t: "Moderación", d: "Aprobá a mano o dejá la aprobación automática." },
            { icon: Tv, t: "Proyección en vivo", d: "Pantalla completa, transiciones y tu propio diseño." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-line bg-surface/70 p-5">
              <Icon className="size-6 text-violet-300" />
              <p className="mt-3 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 inline-flex items-center gap-2 text-sm text-faint"><CheckCircle2 className="size-4" /> Funciona con TV, proyector o pantalla LED</p>
      </section>
    </main>
  );
}
