import Link from "next/link";
import { CalendarDays, ImageIcon, MapPin, Plus, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EventTypeIcon } from "@/components/panel/event-type-icon";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { listEventsForUser } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

export const metadata = { title: "Mis eventos" };

export default async function PanelPage() {
  const user = await requireUser();
  const events = await listEventsForUser(user);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-300">Hola, {user.name.split(" ")[0]}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Mis eventos</h1>
        </div>
        <ButtonLink href="/panel/eventos/nuevo" size="md">
          <Plus className="size-4" /> Nuevo evento
        </ButtonLink>
      </div>

      {events.length === 0 ? (
        <div className="card-hero rounded-3xl border border-line-strong p-8 text-center sm:p-12">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl btn-gradient">
            <Tv className="size-7 text-white" />
          </span>
          <h2 className="mt-5 text-xl font-bold">Creá tu primer evento</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Generá un QR para tus invitados y mostrá sus fotos y videos en vivo en la pantalla del salón.
          </p>
          <ButtonLink href="/panel/eventos/nuevo" size="lg" className="mt-6">
            <Plus className="size-4" /> Crear evento
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/panel/eventos/${e.id}`}
                className="group block h-full rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl" style={{ background: `${e.brandColor}26`, color: e.brandColor }}>
                    <EventTypeIcon type={e.type} className="size-5" />
                  </span>
                  {e.projectionSettings?.enabled ? (
                    <Badge tone="success" dot>Proyección encendida</Badge>
                  ) : (
                    <Badge dot>Proyección apagada</Badge>
                  )}
                </div>
                <h2 className="mt-4 line-clamp-1 text-lg font-semibold group-hover:text-white">{e.name}</h2>
                <p className="text-sm text-faint">{EVENT_TYPE_LABELS[e.type]}</p>
                <div className="mt-4 space-y-1.5 text-sm text-muted">
                  <p className="flex items-center gap-2"><CalendarDays className="size-4 text-faint" /> {formatDate(e.date)}</p>
                  {e.venue && <p className="flex items-center gap-2"><MapPin className="size-4 text-faint" /> <span className="line-clamp-1">{e.venue}</span></p>}
                  <p className="flex items-center gap-2"><ImageIcon className="size-4 text-faint" /> {e._count.media} {e._count.media === 1 ? "contenido" : "contenidos"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
