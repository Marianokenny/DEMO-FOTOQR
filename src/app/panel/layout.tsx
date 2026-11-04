import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo href="/panel" />
          <div className="flex items-center gap-5">
            <p className="hidden text-sm sm:block">
              {user.name} <span className="eyebrow ml-2 text-faint">{user.role === "admin" ? "Admin" : "Organizador"}</span>
            </p>
            <form action={logoutAction}>
              <button className="eyebrow text-muted underline-offset-4 hover:text-primary hover:underline" aria-label="Cerrar sesión">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">{children}</main>
    </div>
  );
}
