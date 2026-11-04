import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEventAction, updateEventAction } from "@/app/actions/events";
import { DeleteEventButton } from "@/components/panel/delete-event-button";
import { EventForm } from "@/components/panel/event-form";
import { GuestLinkPanel } from "@/components/panel/guest-link-panel";
import { ModerationBoard } from "@/components/panel/moderation-board";
import { ProjectionPanel } from "@/components/panel/projection-panel";
import { linkUrl } from "@/lib/links";
import { ProjectionCard } from "@/components/panel/projection-card";
import { Card, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate, toLocalInputValue } from "@/lib/dates";
import { getEventForUser, getEventStats } from "@/lib/events";
import { ForbiddenError, getEventRole, roleAllows } from "@/lib/permissions";
import { EVENT_TYPE_LABELS } from "@/lib/validation";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "proyeccion", label: "Proyección" },
  { id: "invitados", label: "Link para invitados" },
  { id: "moderacion", label: "Moderación" },
  { id: "galeria", label: "Galería", stage: 6 },
  { id: "configuracion", label: "Configuración" },
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
  const screenLink = event.links.find((l) => l.type === "screen");

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link href="/panel" className="eyebrow inline-block text-muted hover:text-primary">← Mis eventos</Link>

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-muted">
            <span className="size-2 rounded-full" style={{ background: event.brandColor }} />
            {EVENT_TYPE_LABELS[event.type]} · {role === "owner" ? "Dueño" : "Moderador"}
          </p>
          <h1 className="display mt-3 text-5xl sm:text-7xl">{event.name}</h1>
          <p className="mt-3 text-muted">
            {formatDate(event.date, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            {event.venue && <> · {event.venue}</>}
          </p>
        </div>
      </header>

      <nav className="-mx-5 overflow-x-auto border-b border-line px-5" aria-label="Secciones del evento">
        <ul className="flex min-w-max gap-7">
          {TABS.filter((t) => t.id !== "configuracion" || canConfigure).map((t) => (
            <li key={t.id}>
              <Link
                href={`?tab=${t.id}`}
                scroll={false}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 py-3.5 text-[15px] transition-colors",
                  t.id === tab ? "border-primary font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.label}
                {"stage" in t && <span className="font-mono text-[10px] text-faint">E{t.stage}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {guardado && (
        <p className="rounded-[10px] border border-success/40 px-4 py-3 text-sm text-success">Cambios guardados.</p>
      )}

      {tab === "resumen" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProjectionCard eventName={event.name} settings={event.projectionSettings!} stats={stats} screenHref={screenLink ? linkUrl("screen", screenLink.token) : undefined} configureHref="?tab=proyeccion" />
          </div>
          <Card>
            <CardTitle>Datos del evento</CardTitle>
            <dl className="mt-5 text-[15px]">
              <Row label="Fecha">{formatDate(event.date, { day: "numeric", month: "short", year: "numeric" })}</Row>
              <Row label="Lugar">{event.venue ?? "Sin indicar"}</Row>
              <Row label="Fotos hasta">{formatDate(event.storageUntil, { day: "numeric", month: "short", year: "numeric" })}</Row>
              <Row label="Color">
                <span className="inline-flex items-center gap-2 font-mono text-sm"><span className="size-3.5 rounded-full" style={{ background: event.brandColor }} />{event.brandColor}</span>
              </Row>
              <Row label="Enlaces">{event.links.length} de 3</Row>
            </dl>
          </Card>
        </div>
      )}

      {tab === "proyeccion" && (
        <ProjectionPanel eventId={event.id} settings={event.projectionSettings!} screenLink={screenLink} canConfigure={canConfigure} />
      )}

      {tab === "moderacion" && (
        <ModerationBoard eventId={event.id} initialAutoApprove={event.projectionSettings!.autoApprove} canConfigure={canConfigure} />
      )}

      {tab === "invitados" && (
        <GuestLinkPanel
          eventId={event.id}
          link={event.links.find((l) => l.type === "upload")}
          settings={event.uploadSettings!}
          canConfigure={canConfigure}
        />
      )}

      {tab === "configuracion" && canConfigure && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle className="mb-6">Datos del evento</CardTitle>
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
          <Card className="h-fit space-y-4 border-danger/30">
            <CardTitle className="text-danger">Zona de peligro</CardTitle>
            <p className="text-sm text-muted">Borrar el evento elimina sus enlaces, la configuración y todo el contenido recibido.</p>
            <DeleteEventButton action={deleteEventAction.bind(null, event.id)} eventName={event.name} />
          </Card>
        </div>
      )}

      {"stage" in active && (
        <div className="rounded-[14px] border border-dashed border-line-strong px-6 py-20 text-center">
          <p className="eyebrow text-primary">Etapa {active.stage}</p>
          <h2 className="display mt-3 text-5xl">{active.label}</h2>
          <p className="mt-3 text-muted">Esta sección llega en la etapa {active.stage} del plan.</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
