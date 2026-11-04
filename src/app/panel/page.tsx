import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { listEventsForUser } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

export const metadata = { title: "Mis eventos" };

export default async function PanelPage() {
  const user = await requireUser();
  const events = await listEventsForUser(user);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="eyebrow text-primary">Hola, {user.name.split(" ")[0]}</p>
          <h1 className="display mt-3 text-6xl sm:text-7xl">Mis <em>eventos</em></h1>
        </div>
        <ButtonLink href="/panel/eventos/nuevo">+ Nuevo evento</ButtonLink>
      </div>

      {events.length === 0 ? (
        <div className="rounded-[14px] bg-paper p-8 text-on-paper sm:p-14">
          <p className="eyebrow text-on-paper-muted">Empecemos</p>
          <h2 className="display mt-4 max-w-xl text-5xl sm:text-6xl">Tu primer evento está a <em className="text-primary">un minuto</em>.</h2>
          <p className="mt-4 max-w-md text-on-paper-muted">Lo creás, imprimís el QR y listo: las fotos de los invitados empiezan a llegar.</p>
          <ButtonLink href="/panel/eventos/nuevo" variant="dark" size="lg" className="mt-8">Crear evento <Arrow /></ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/panel/eventos/${e.id}`}
                className="group flex h-full flex-col rounded-[14px] border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <div className="h-1.5 rounded-t-[14px]" style={{ background: e.brandColor }} />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow text-muted">{formatDate(e.date, { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "")}</span>
                    {e.projectionSettings?.enabled ? <Badge tone="success" dot pulse>En vivo</Badge> : <Badge dot>Apagada</Badge>}
                  </div>
                  <h2 className="display mt-5 mb-8 text-4xl transition-colors group-hover:text-primary">{e.name}</h2>
                  <p className="-mt-6 mb-8 text-sm text-muted">{EVENT_TYPE_LABELS[e.type]}{e.venue ? ` · ${e.venue}` : ""}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
                    <span className="font-mono text-sm text-muted"><span className="text-ink">{e._count.media}</span> {e._count.media === 1 ? "archivo" : "archivos"}</span>
                    <span className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-primary">→</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
