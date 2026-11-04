import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createEventAction } from "@/app/actions/events";
import { EventForm } from "@/components/panel/event-form";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Nuevo evento" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/panel" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Mis eventos
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo evento</h1>
        <p className="mt-1 text-sm text-muted">Al crearlo generamos automáticamente el link para invitados, la pantalla y la galería.</p>
      </div>
      <Card>
        <EventForm action={createEventAction} submitLabel="Crear evento" />
      </Card>
    </div>
  );
}
