import Link from "next/link";
import { createEventAction } from "@/app/actions/events";
import { EventForm } from "@/components/panel/event-form";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Nuevo evento" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href="/panel" className="eyebrow inline-block text-muted hover:text-primary">← Mis eventos</Link>
      <div>
        <h1 className="display text-6xl">Nuevo <em>evento</em></h1>
        <p className="mt-3 text-muted">Al crearlo generamos el link para invitados, la pantalla y la galería.</p>
      </div>
      <Card>
        <EventForm action={createEventAction} submitLabel="Crear evento" />
      </Card>
    </div>
  );
}
