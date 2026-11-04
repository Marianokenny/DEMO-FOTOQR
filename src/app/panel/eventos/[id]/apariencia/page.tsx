import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppearanceEditor } from "@/components/panel/appearance-editor";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEventForUser } from "@/lib/events";
import { ForbiddenError, getEventRole, roleAllows } from "@/lib/permissions";
import { buildScreenState } from "@/lib/projection";
import { screenFontsClass } from "@/lib/screen-fonts";
import { storage } from "@/lib/storage";

export const metadata: Metadata = { title: "Apariencia de la pantalla" };
export const dynamic = "force-dynamic";

export default async function AppearancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let event;
  try {
    event = await getEventForUser(user, id);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  if (!roleAllows(await getEventRole(user, id), "configure")) notFound();

  const state = await buildScreenState(id);
  const st = storage();
  const sample = await db.media.findFirst({
    where: { eventId: id, status: "approved", type: "photo", displayKey: { not: null } },
    orderBy: { approvedAt: "desc" },
  });
  const assets = await db.asset.findMany({ where: { eventId: id }, orderBy: { createdAt: "asc" } });
  const assetList = await Promise.all(assets.map(async (a) => ({
    id: a.id, usage: a.usage, url: await st.presignDownload(a.key, 12 * 3600), width: a.width, height: a.height,
  })));
  const screenLink = event.links.find((l) => l.type === "screen");

  return (
    <div className={`${screenFontsClass} space-y-6`}>
      <Link href={`/panel/eventos/${id}?tab=proyeccion`} className="eyebrow inline-block text-muted hover:text-primary">← {event.name}</Link>
      <header>
        <p className="eyebrow text-muted">Proyección</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">Apariencia <em className="text-primary">de la pantalla</em></h1>
        <p className="mt-3 max-w-2xl text-muted">Los cambios se guardan solos y se ven en la pantalla del salón en un par de segundos, sin recargarla.</p>
      </header>
      <AppearanceEditor
        eventId={id}
        initial={state.appearance}
        initialAssets={assetList}
        showSenderName={state.settings.showSenderName}
        event={state.event}
        uploadUrl={state.uploadUrl}
        sample={sample?.displayKey ? { url: await st.presignDownload(sample.displayKey, 12 * 3600), senderName: sample.senderName } : null}
        screenHref={screenLink ? `/pantalla/${screenLink.token}` : null}
      />
    </div>
  );
}
