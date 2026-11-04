import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveControl } from "@/components/panel/live-control";
import { requireUser } from "@/lib/auth";
import { getEventForUser } from "@/lib/events";
import { readFeatures } from "@/lib/features";
import { getLive } from "@/lib/live";
import { ForbiddenError, getEventRole, roleAllows } from "@/lib/permissions";

export const metadata: Metadata = { title: "Control en vivo" };
export const dynamic = "force-dynamic";

export default async function ControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let event;
  try {
    event = await getEventForUser(user, id);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const role = await getEventRole(user, id);
  if (!roleAllows(role, "moderate")) notFound();
  const s = event.projectionSettings!;
  return (
    <div className="space-y-5">
      <Link href={`/panel/eventos/${id}?tab=proyeccion`} className="eyebrow inline-block text-muted hover:text-primary">← {event.name}</Link>
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2 text-primary"><span className="size-2 animate-pulse rounded-full bg-primary" />En vivo</p>
          <h1 className="display mt-2 text-5xl">Control <em className="text-primary">de pantalla</em></h1>
        </div>
      </header>
      <LiveControl
        eventId={id}
        initialLive={await getLive(id)}
        initialFeatures={readFeatures(s.features)}
        projectionOn={s.enabled}
        canConfigure={roleAllows(role, "configure")}
      />
    </div>
  );
}
