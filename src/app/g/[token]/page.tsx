import type { Metadata } from "next";
import { GalleryView } from "@/components/gallery/gallery-view";
import { Logo } from "@/components/logo";
import { formatDate } from "@/lib/dates";
import { getPublicGallery } from "@/lib/gallery";
import { LinkError } from "@/lib/links";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  try {
    const g = await getPublicGallery((await params).token);
    return { title: `Galería · ${g.event.name}`, robots: { index: false } };
  } catch {
    return { title: "Galería no disponible", robots: { index: false } };
  }
}

export default async function PublicGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let gallery;
  try {
    gallery = await getPublicGallery(token);
  } catch (e) {
    if (!(e instanceof LinkError)) throw e;
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="eyebrow text-muted">Galería no disponible</p>
          <h1 className="display mt-4 text-5xl">Esta galería <em className="text-primary">ya cerró</em></h1>
          <p className="mt-4 text-muted">{e.reason === "expired" || e.reason === "archived"
              ? "Terminó el período en que las fotos estaban guardadas."
              : e.reason === "revoked" ? "El organizador generó un link nuevo. Pedíselo para seguir viendo las fotos." : e.message}</p>
        </div>
      </main>
    );
  }
  const { event, counts } = gallery;
  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-8">
      <Logo />
      <header className="mt-10 mb-8 sm:mt-14">
        <p className="eyebrow flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: event.color }} />
          {formatDate(new Date(event.date), { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="display mt-3 text-5xl sm:text-7xl">{event.name}</h1>
        <p className="mt-3 text-muted">
          <span className="font-mono text-ink">{counts.photo}</span> {counts.photo === 1 ? "foto" : "fotos"} · <span className="font-mono text-ink">{counts.video}</span> {counts.video === 1 ? "video" : "videos"} ·
          disponible hasta el {formatDate(new Date(event.storageUntil), { day: "numeric", month: "long" })}
        </p>
      </header>
      <GalleryView gallery={gallery} zipUrl={`/api/g/${token}/zip`} />
    </main>
  );
}
