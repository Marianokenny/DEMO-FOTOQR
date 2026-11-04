import type { AccessLink, ProjectionSettings } from "@prisma/client";
import { regenerateLinkAction } from "@/app/actions/links";
import { saveProjectionSettingsAction } from "@/app/actions/projection";
import Link from "next/link";
import { Arrow, buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { toLocalInputValue } from "@/lib/dates";
import { linkUrl } from "@/lib/links";
import { CopyButton } from "./copy-button";
import { ProjectionSettingsForm } from "./projection-settings-form";
import { ProjectionToggle } from "./projection-toggle";
import { RegenerateLinkButton } from "./regenerate-link-button";

export function ProjectionPanel({ eventId, settings, screenLink, canConfigure }: {
  eventId: string; settings: ProjectionSettings; screenLink: AccessLink | undefined; canConfigure: boolean;
}) {
  const expired = !!settings.expiresAt && settings.expiresAt.getTime() < Date.now();
  const url = screenLink ? linkUrl("screen", screenLink.token) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        {canConfigure && <ProjectionToggle eventId={eventId} enabled={settings.enabled} expired={expired} />}
        {canConfigure && (
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Apariencia</CardTitle>
              <p className="mt-1 text-sm text-muted">Fondo, capas, texto de espera, tipografías y nombre del remitente.</p>
            </div>
            <Link href={`/panel/eventos/${eventId}/apariencia`} className={buttonClass("primary", "md")}>Editar apariencia <Arrow /></Link>
          </Card>
        )}
        {canConfigure && (
          <Card>
            <CardTitle className="mb-6">Cómo se reproduce</CardTitle>
            <ProjectionSettingsForm
              action={saveProjectionSettingsAction.bind(null, eventId)}
              defaults={{
                expiresAt: settings.expiresAt ? toLocalInputValue(settings.expiresAt) : "",
                photoSeconds: settings.photoSeconds, videoMode: settings.videoMode, videoMaxSeconds: settings.videoMaxSeconds,
                videoMuted: settings.videoMuted, transition: settings.transition, playOrder: settings.playOrder, showSenderName: settings.showSenderName,
              }}
            />
          </Card>
        )}
      </div>
      <div className="space-y-6">
        <section className="rounded-[14px] bg-paper p-6 text-on-paper sm:p-8">
          <p className="eyebrow text-on-paper-muted">Link de la pantalla</p>
          <h2 className="display mt-3 text-4xl">Abrilo en la compu <em className="text-primary">conectada a la pantalla</em></h2>
          <ol className="mt-5 space-y-2 text-[15px] text-on-paper-muted">
            <li><span className="font-mono text-on-paper">1.</span> Conectá la compu al televisor, proyector o LED.</li>
            <li><span className="font-mono text-on-paper">2.</span> Abrí este link en Chrome.</li>
            <li><span className="font-mono text-on-paper">3.</span> Hacé clic en la pantalla y apretá <kbd className="rounded bg-on-paper/10 px-1.5 font-mono">F</kbd> para pantalla completa.</li>
          </ol>
          {url ? (
            <>
              <p className="mt-5 break-all rounded-[10px] bg-white/70 px-4 py-3 font-mono text-sm">{url}</p>
              <div className="mt-4 flex flex-wrap gap-2 [&_button]:border-on-paper/25 [&_button]:text-on-paper">
                <a href={url} target="_blank" rel="noreferrer" className={buttonClass("dark", "md")}>Entrar a la proyección ↗</a>
                <CopyButton text={url} />
              </div>
              <p className="mt-4 text-[13px] text-on-paper-muted">Este link es distinto al de los invitados: no lo compartas en el QR.</p>
            </>
          ) : (
            <p className="mt-5 text-sm">No hay un link de pantalla activo.</p>
          )}
          {canConfigure && <div className="mt-3 [&_button]:text-on-paper"><RegenerateLinkButton action={regenerateLinkAction.bind(null, eventId, "screen")} /></div>}
        </section>
        <Card>
          <CardTitle>Durante el evento</CardTitle>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Lo nuevo que apruebes entra primero; cuando no hay nada nuevo, repite todo en bucle.</li>
            <li>Si se corta internet, la pantalla sigue con lo que tiene y se reconecta sola.</li>
            <li>Los cambios de configuración se aplican sin recargar la pantalla.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
