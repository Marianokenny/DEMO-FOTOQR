import { Fragment } from "react";
import { HeroRobot } from "@/components/brand/hero-robot";
import { Logo } from "@/components/logo";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

const STEPS = [
  { n: "01", t: "Escanean el QR", d: "Desde la mesa, con cualquier celular. Sin app y sin crear cuenta." },
  { n: "02", t: "Vos moderás", d: "Aprobás cada foto a mano, o dejás que entren solas y sacás lo que no va." },
  { n: "03", t: "Sale en pantalla", d: "En el LED, la tele o el proyector, en vivo y con el diseño de tu evento." },
];

const HEADLINE = ["Las", "fotos", "de", "tus", "invitados,", "en vivo", "en", "la", "pantalla", "grande."];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Logo />
        {user ? (
          <ButtonLink href="/panel" size="sm" variant="secondary">Ir al panel <Arrow /></ButtonLink>
        ) : (
          <div className="flex items-center gap-1">
            <ButtonLink href="/login" variant="ghost" size="sm">Ingresar</ButtonLink>
            <ButtonLink href="/registro" size="sm">Crear cuenta</ButtonLink>
          </div>
        )}
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-24">
        <HeroRobot className="absolute -top-2 right-2 hidden w-[230px] lg:block xl:-right-10 xl:w-[270px]" />
        <p className="eyebrow text-primary" style={{ animation: "fq-word 600ms both" }}>15 · Casamientos · Cumpleaños · Empresas</p>
        <h1 className="display mt-6 max-w-5xl text-[56px] sm:text-[104px]">
          {HEADLINE.map((w, i) => (
            <Fragment key={i}>
              <span className="inline-block" style={{ animation: `fq-word 700ms cubic-bezier(.2,.8,.2,1) ${150 + i * 70}ms both` }}>
                {w === "en vivo" ? <em className="text-primary">{w}</em> : w}
              </span>{" "}
            </Fragment>
          ))}
        </h1>
        <HeroRobot className="mx-auto mt-10 w-[170px] lg:hidden" />
        <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-md text-lg text-muted">
            Un QR en cada mesa. Los invitados suben, vos aprobás, y el salón lo ve al instante.
          </p>
          <ButtonLink href={user ? "/panel" : "/registro"} size="lg">Crear mi evento <Arrow /></ButtonLink>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <ol className="grid border-t border-line sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} style={{ animation: `fq-word 700ms ${900 + Number(s.n) * 150}ms both` }} className="border-b border-line py-8 sm:border-b-0 sm:border-r sm:px-8 sm:first:pl-0 sm:last:border-r-0">
              <span className="font-mono text-sm text-primary">{s.n}</span>
              <h2 className="display mt-3 text-4xl">{s.t}</h2>
              <p className="mt-3 text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
