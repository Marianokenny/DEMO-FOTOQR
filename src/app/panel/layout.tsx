import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="bg-glow min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo href="/panel" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-xs text-faint">{user.role === "admin" ? "Administrador" : "Organizador"}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-violet-200">{initials}</span>
            <form action={logoutAction}>
              <button className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink" title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut className="size-4.5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}
