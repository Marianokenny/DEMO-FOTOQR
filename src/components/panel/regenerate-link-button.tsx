"use client";

import { Button } from "@/components/ui/button";

export function RegenerateLinkButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("¿Generar un link nuevo? El link y el QR actuales dejan de funcionar, y vas a tener que reimprimir los carteles.")) e.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="px-0 underline decoration-line-strong underline-offset-4 hover:decoration-primary">
        Generar un link nuevo
      </Button>
    </form>
  );
}
