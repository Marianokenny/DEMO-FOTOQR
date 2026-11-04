import type { AccessLink } from "@prisma/client";
import { regenerateLinkAction } from "@/app/actions/links";
import { GalleryView } from "@/components/gallery/gallery-view";
import { buttonClass } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import type { Gallery } from "@/lib/gallery";
import { linkUrl } from "@/lib/links";
import { CopyButton } from "./copy-button";
import { RegenerateLinkButton } from "./regenerate-link-button";

export function GalleryPanel({ gallery, link, canConfigure }: { gallery: Gallery; link: AccessLink | undefined; canConfigure: boolean }) {
  const { event } = gallery;
  const until = formatDate(new Date(event.storageUntil), { day: "numeric", month: "long", year: "numeric" });
  const url = link ? linkUrl("gallery", link.token) : null;

  if (event.filesDeleted) {
    return (
      <div className="rounded-[14px] border border-line-strong px-6 py-14 text-center">
        <p className="eyebrow text-muted">Período de guardado terminado</p>
        <p className="display mt-3 text-4xl">Los archivos se borraron el {until}</p>
        <p className="mx-auto mt-3 max-w-md text-muted">Así lo indica el plazo de guardado del evento. Las cifras del evento se conservan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[14px] bg-paper p-6 text-on-paper sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <p className="eyebrow text-on-paper-muted">Link de la galería</p>
          <h2 className="display mt-3 text-4xl">Compartí los recuerdos <em className="text-primary">con todos</em></h2>
          <p className="mt-3 text-[15px] text-on-paper-muted">
            Quien tenga el link ve y descarga lo aprobado, sin registrarse. Disponible hasta el <strong className="text-on-paper">{until}</strong>; ese día se borran los archivos.
          </p>
          {url && <p className="mt-4 break-all rounded-[10px] bg-white/70 px-4 py-3 font-mono text-sm" data-testid="gallery-url">{url}</p>}
          {canConfigure && <div className="mt-3 [&_button]:text-on-paper"><RegenerateLinkButton action={regenerateLinkAction.bind(null, event.id, "gallery")} confirmText="¿Generar un link nuevo? Quienes tengan el link actual ya no van a poder entrar a la galería." /></div>}
        </div>
        {url ? (
          <div className="flex flex-wrap gap-2 [&_button]:border-on-paper/25 [&_button]:text-on-paper">
            <a href={url} target="_blank" rel="noreferrer" className={buttonClass("dark", "md")}>Abrir galería ↗</a>
            <CopyButton text={url} />
          </div>
        ) : (
          <p className="text-sm">No hay un link de galería activo.</p>
        )}
      </section>
      <GalleryView gallery={gallery} zipUrl={`/api/events/${event.id}/gallery/zip`} manageEventId={canConfigure ? event.id : undefined} />
      {canConfigure && <p className="text-sm text-muted">El plazo de guardado se cambia en Configuración.</p>}
    </div>
  );
}
