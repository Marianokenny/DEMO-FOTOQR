import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Images, LayoutDashboard, MapPin, QrCode, Settings, ShieldCheck, Tv } from "lucide-react";
import { deleteEventAction, updateEventAction } from "@/app/actions/events";
import { DeleteEventButton } from "@/components/panel/delete-event-button";
import { EventForm } from "@/components/panel/event-form";
import { EventTypeIcon } from "@/components/panel/event-type-icon";
import { ProjectionCard } from "@/components/panel/projection-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, toLocalInputValue } from "@/lib/dates";
import { getEventForUser, getEventStats } from "@/lib/events";
import { ForbiddenError, getEventRole, roleAllows } from "@/lib/permissions";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "proyeccion", label: "Proyección", icon: Tv, stage: 4 },
  { id: "invitados", label: "Link para invitados", icon: QrCode, stage: 2 },
  { id: "moderacion", label: "Moderación", icon: ShieldCheck, stage: 3 },
  { id: "galeria", label: "Galería", icon: Images, stage: 6 },
  { id: "configuracion", label: "Configuración", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function EventPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, guardado } = await searchParams;
  const user = await requireUser();

  let event;
  try {
    event = await getEventForUser(user, id);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const role = await getEventRole(user, id);
  const canConfigure = roleAllows(role, "configure");
  const stats = await getEventStats(id);
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "resumen";
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-6">
      <Link href="/panel" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Mis eventos
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl" style={{ background: `${event.brandColor}26`, color: event.brandColor }}>
          <EventTypeIcon type={event.type} className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{event.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>{EVENT_TYPE_LABELS[event.type]}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-faint" />{formatDateTime(event.date)}</span>
            {event.venue && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-faint" />{event.venue}</span>}
          </div>
        </div>
        <Badge tone="primary">{role === "owner" ? "Dueño" : "Moderador"}</Badge>
      </header>

      <nav className="-mx-4 overflow-x-auto px-4" aria-label="Secciones del evento">
        <ul className="flex min-w-max gap-1 rounded-2xl border border-line bg-surface/70 p-1">
          {TABS.filter((t) => t.id !== "configuracion" || canConfigure).map((t) => (
            <li key={t.id}>
              <Link
                href={`?tab=${t.id}`}
                scroll={false}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  t.id === tab ? "bg-primary-soft text-white ring-1 ring-primary/40" : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {guardado && (
        <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> Cambios guardados.
        </p>
      )}

      {tab === "resumen" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProjectionCard eventName={event.name} settings={event.projectionSettings!} stats={stats} />
          </div>
          <Card className="space-y-4">
            <CardTitle>Datos del evento</CardTitle>
            <dl className="space-y-3 text-sm">
              <Row label="Fecha">{formatDate(event.date, { dateStyle: "full" })}</Row>
              <Row label="Lugar">{event.venue ?? "Sin indicar"}</Row>
              <Row label="Fotos guardadas hasta">{formatDate(event.storageUntil)}</Row>
              <Row label="Color">
                <span className="inline-flex items-center gap-2"><span className="size-4 rounded-full" style={{ background: event.brandColor }} />{event.brandColor}</span>
              </Row>
              <Row label="Enlaces generados">{event.links.length} de 3</Row>
            </dl>
          </Card>
        </div>
      )}

      {tab === "configuracion" && canConfigure && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle className="mb-5">Datos del evento</CardTitle>
            <EventForm
              action={updateEventAction.bind(null, event.id)}
              submitLabel="Guardar cambios"
              defaults={{
                name: event.name, type: event.type, date: toLocalInputValue(event.date), venue: event.venue ?? "",
                brandColor: event.brandColor,
                storageDays: String(Math.round((event.storageUntil.getTime() - event.date.getTime()) / 86400000)),
              }}
            />
          </Card>
          <Card className="h-fit space-y-3 border-danger/25">
            <CardTitle>Zona de peligro</CardTitle>
            <p className="text-sm text-muted">Borrar el evento elimina sus enlaces, la configuración y todo el contenido recibido.</p>
            <DeleteEventButton action={deleteEventAction.bind(null, event.id)} eventName={event.name} />
          </Card>
        </div>
      )}

      {"stage" in active && (
        <Card className="grid place-items-center py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-violet-200"><active.icon className="size-6" /></span>
          <h2 className="mt-4 text-lg font-semibold">{active.label}</h2>
          <p className="mt-1 text-sm text-muted">Esta sección llega en la etapa {active.stage} del plan.</p>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
