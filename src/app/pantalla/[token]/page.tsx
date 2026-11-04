import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Great_Vibes, Montserrat, Playfair_Display } from "next/font/google";
import { ProjectionPlayer } from "@/components/screen/projection-player";
import { LinkError } from "@/lib/links";
import { getScreenState } from "@/lib/projection";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-greatvibes" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

export const metadata: Metadata = { title: "Proyección", robots: { index: false } };
export const viewport: Viewport = { themeColor: "#000000" };
export const dynamic = "force-dynamic";

export default async function ScreenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const state = await getScreenState(token);
    return (
      <div className={`${playfair.variable} ${greatVibes.variable} ${bebas.variable} ${montserrat.variable}`}>
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
