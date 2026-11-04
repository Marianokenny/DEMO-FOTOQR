import type { ProjectionSettings } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";

type Stats = { received: number; photos: number; videos: number; approved: number; pending: number };

export function ProjectionCard({ eventName, settings, stats, screenHref, configureHref }: {
  eventName: string;
  settings: ProjectionSettings;
  stats: Stats;
  screenHref?: string;
  configureHref?: string;
}) {
  const expired = settings.expiresAt ? settings.expiresAt.getTime() < Date.now() : false;
  const on = settings.enabled && !expired;
  const soon = "pointer-events-none opacity-40";

  return (
    <section className="rounded-[14px] bg-paper text-on-paper">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
        <div>
          <p className="eyebrow text-on-paper-muted">Proyección en vivo</p>
          <h2 className="display mt-3 text-5xl sm:text-6xl">{eventName}</h2>
        </div>
        {on ? (
          <Badge tone="success" dot pulse className="text-emerald-700">Encendida</Badge>
        ) : (
          <Badge tone={expired ? "danger" : "neutral"} dot className={expired ? "text-red-700" : "text-on-paper-muted"}>{expired ? "Vencida" : "Apagada"}</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 border-y border-on-paper/15 sm:grid-cols-4">
        <Stat label="Recibidos" value={stats.received} />
        <Stat label="Aprobados" value={stats.approved} />
        <Stat label="Pendientes" value={stats.pending} accent={stats.pending > 0} />
        <Stat label="Fotos / videos" value={`${stats.photos}/${stats.videos}`} />
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
        <ul className="space-y-1 font-mono text-[13px] text-on-paper-muted">
          <li>Vence · <span className="text-on-paper">{settings.expiresAt ? formatDateTime(settings.expiresAt) : "sin vencimiento"}</span></li>
          <li>Aprobación automática · <span className="text-on-paper">{settings.autoApprove ? "sí" : "no"}</span></li>
        </ul>
        <div className="flex flex-wrap gap-2">
          {configureHref ? (
            <a href={configureHref} className={buttonClass("secondary", "md", "border-on-paper/25 text-on-paper hover:bg-on-paper hover:text-paper")}>Configurar</a>
          ) : (
            <span className={buttonClass("secondary", "md", `border-on-paper/25 text-on-paper ${soon}`)} title="Disponible en la etapa 4">Configurar</span>
          )}
          {screenHref ? (
            <a href={screenHref} target="_blank" rel="noreferrer" className={buttonClass("dark", "md")}>Entrar a la proyección ↗</a>
          ) : (
            <span className={buttonClass("dark", "md", soon)} title="Disponible en la etapa 4">Entrar a la proyección ↗</span>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="border-on-paper/15 p-6 even:border-l sm:border-l sm:first:border-l-0 sm:p-8 [&:nth-child(n+3)]:border-t sm:[&:nth-child(n+3)]:border-t-0">
      <dt className="eyebrow text-on-paper-muted">{label}</dt>
      <dd className={`display mt-2 text-6xl tabular-nums ${accent ? "text-primary" : ""}`}>{value}</dd>
    </div>
  );
}
