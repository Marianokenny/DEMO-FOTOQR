import { CalendarClock, CheckCircle2, Clock, ImageIcon, Play, Settings2, Sparkles, Video } from "lucide-react";
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
  return (
    <section className="card-hero relative overflow-hidden rounded-3xl border border-line-strong p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Proyección en vivo</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{eventName}</h2>
        </div>
        {on ? (
          <Badge tone="success" dot className="text-sm">Encendida</Badge>
        ) : (
          <Badge tone={expired ? "danger" : "neutral"} dot className="text-sm">{expired ? "Vencida" : "Apagada"}</Badge>
        )}
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<ImageIcon className="size-4" />} label="Recibidos" value={stats.received} detail={`${stats.photos} fotos · ${stats.videos} videos`} />
        <Stat icon={<CheckCircle2 className="size-4" />} label="Aprobados" value={stats.approved} />
        <Stat icon={<Clock className="size-4" />} label="Pendientes" value={stats.pending} highlight={stats.pending > 0} />
        <Stat icon={<Video className="size-4" />} label="Videos" value={stats.videos} />
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="size-4 text-violet-300" />
          {settings.expiresAt ? <>Vence el {formatDateTime(settings.expiresAt)}</> : "Sin vencimiento"}
        </span>
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-4 text-violet-300" />
          Aprobación automática: <strong className={settings.autoApprove ? "text-success" : "text-ink"}>{settings.autoApprove ? "activada" : "desactivada"}</strong>
        </span>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-3">
        {screenHref ? (
          <a href={screenHref} target="_blank" rel="noreferrer" className={buttonClass("primary", "lg")}>
            <Play className="size-4" /> Entrar a la proyección
          </a>
        ) : (
          <span className={buttonClass("primary", "lg", "pointer-events-none opacity-50")} title="Disponible en la etapa 4">
            <Play className="size-4" /> Entrar a la proyección
          </span>
        )}
        {configureHref ? (
          <a href={configureHref} className={buttonClass("secondary", "lg")}><Settings2 className="size-4" /> Configurar</a>
        ) : (
          <span className={buttonClass("secondary", "lg", "pointer-events-none opacity-50")} title="Disponible en la etapa 4">
            <Settings2 className="size-4" /> Configurar
          </span>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, label, value, detail, highlight }: {
  icon: React.ReactNode; label: string; value: number; detail?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-warning/40 bg-warning/10" : "border-white/10 bg-white/5"}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{label}</p>
      <p className="mt-1.5 text-3xl font-bold tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-faint">{detail}</p>}
    </div>
  );
}
