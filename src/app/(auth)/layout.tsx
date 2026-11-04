import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/panel");
  return (
    <main className="bg-glow grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-line bg-surface/80 p-6 shadow-2xl shadow-violet-950/40 backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
