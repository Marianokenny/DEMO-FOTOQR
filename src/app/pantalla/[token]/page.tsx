import type { Metadata, Viewport } from "next";
import { ProjectionPlayer } from "@/components/screen/projection-player";
import { LinkError } from "@/lib/links";
import { getScreenState } from "@/lib/projection";
import { screenFontsClass } from "@/lib/screen-fonts";


export const metadata: Metadata = { title: "Proyección", robots: { index: false } };
export const viewport: Viewport = { themeColor: "#000000" };
export const dynamic = "force-dynamic";

export default async function ScreenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const state = await getScreenState(token);
    return (
      <div className={screenFontsClass}>
        <style>{"body::before{display:none}"}</style>
        <ProjectionPlayer token={token} initial={state} />
      </div>
    );
  } catch (e) {
    if (!(e instanceof LinkError)) throw e;
    return (
      <main className="grid min-h-dvh place-items-center bg-black px-6 text-center text-paper">
        <div>
          <p className="eyebrow text-muted">Pantalla no disponible</p>
          <p className="display mt-4 text-5xl">{e.message}</p>
        </div>
      </main>
    );
  }
}
