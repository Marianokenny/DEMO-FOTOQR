import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/panel");
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-paper p-12 text-on-paper lg:flex">
        <div className="[&_span.display]:text-on-paper">
          <Logo />
        </div>
        <div>
          <p className="display text-[72px]">
            Que la fiesta <em className="text-primary">se vea</em> desde todas las mesas.
          </p>
          <p className="eyebrow mt-8 text-on-paper-muted">Fotos y videos en vivo para eventos</p>
        </div>
      </aside>
      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <div className="m-auto w-full max-w-sm py-10">{children}</div>
      </section>
    </main>
  );
}
