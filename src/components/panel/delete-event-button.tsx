"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteEventButton({ action, eventName }: { action: () => Promise<void>; eventName: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`¿Borrar "${eventName}"? Se eliminan también todas sus fotos y videos. No se puede deshacer.`)) e.preventDefault();
      }}
    >
      <Button variant="danger" type="submit"><Trash2 className="size-4" /> Borrar evento</Button>
    </form>
  );
}
