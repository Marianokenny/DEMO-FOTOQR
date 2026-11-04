import type { AccessLink, UploadSettings } from "@prisma/client";
import { regenerateLinkAction, setLinkExpiryAction, updateUploadSettingsAction } from "@/app/actions/links";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDateTime, toLocalInputValue } from "@/lib/dates";
import { linkUrl } from "@/lib/links";
import { qrSvg } from "@/lib/qr";
import { CopyButton } from "./copy-button";
import { LinkExpiryForm } from "./link-expiry-form";
import { RegenerateLinkButton } from "./regenerate-link-button";
import { UploadLimitsForm } from "./upload-limits-form";

export async function GuestLinkPanel({ eventId, link, settings, canConfigure }: {
  eventId: string; link: AccessLink | undefined; settings: UploadSettings; canConfigure: boolean;
}) {
  if (!link) {
    return (
      <Card className="text-center">
        <p className="text-muted">Este evento no tiene un link activo para invitados.</p>
        {canConfigure && <div className="mt-4 flex justify-center"><RegenerateLinkButton action={regenerateLinkAction.bind(null, eventId, "upload")} /></div>}
      </Card>
    );
  }
  const url = linkUrl("upload", link.token);
  const svg = await qrSvg(url);
  const expired = link.expiresAt ? link.expiresAt.getTime() < Date.now() : false;
  const qrBase = `/api/events/${eventId}/qr?type=upload`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="h-fit rounded-[14px] bg-paper p-6 text-on-paper sm:p-8 lg:sticky lg:top-24">
        <p className="eyebrow text-on-paper-muted">Código QR para invitados</p>
        <div className="mx-auto mt-6 max-w-72 rounded-[10px] bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="display mt-6 text-center text-3xl">Escaneá y <em className="text-primary">subí tus fotos</em></p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <a href={`${qrBase}&format=png&download=1`} className={buttonClass("dark", "md")}>Descargar PNG</a>
          <a href={`${qrBase}&format=svg&download=1`} className={buttonClass("secondary", "md", "border-on-paper/25 text-on-paper hover:bg-on-paper hover:text-paper")}>Descargar SVG</a>
          <a href={`/imprimir/${eventId}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md", "col-span-2 border-on-paper/25 text-on-paper hover:bg-on-paper hover:text-paper")}>Cartel para imprimir ↗</a>
        </div>
      </section>

      <div className="space-y-6">
        <Card>
          <CardTitle>Link para invitados</CardTitle>
          <p className="mt-4 break-all rounded-[10px] border border-line-strong bg-bg-elevated px-4 py-3 font-mono text-sm">{url}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyButton text={url} />
            <a href={url} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>Abrir ↗</a>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
            <span className={expired ? "text-danger" : "text-muted"}>
              {link.expiresAt ? `${expired ? "Venció" : "Vence"} el ${formatDateTime(link.expiresAt)}` : "Sin vencimiento"}
            </span>
            {canConfigure && <RegenerateLinkButton action={regenerateLinkAction.bind(null, eventId, "upload")} />}
          </div>
          <p className="mt-3 text-[13px] text-faint">Usalo en carteles, tarjetas de mesa o en la invitación. Solo sirve para este evento.</p>
        </Card>

        {canConfigure && (
          <Card>
            <CardTitle className="mb-5">Vencimiento</CardTitle>
            <LinkExpiryForm action={setLinkExpiryAction.bind(null, eventId, "upload")} defaultValue={link.expiresAt ? toLocalInputValue(link.expiresAt) : ""} />
          </Card>
        )}

        {canConfigure && (
          <Card>
            <CardTitle className="mb-5">Límites de carga</CardTitle>
            <UploadLimitsForm
              action={updateUploadSettingsAction.bind(null, eventId)}
              defaults={{
                allowVideos: settings.allowVideos, maxPhotoMb: settings.maxPhotoMb, maxVideoMb: settings.maxVideoMb,
                maxVideoSeconds: settings.maxVideoSeconds, maxFilesPerGuest: settings.maxFilesPerGuest,
              }}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
