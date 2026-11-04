"use client";

import { Button } from "@/components/ui/button";

const DEFAULT_CONFIRM = "¿Generar un link nuevo? El link y el QR actuales dejan de funcionar, y vas a tener que reimprimir los carteles.";

export function RegenerateLinkButton({ action, confirmText = DEFAULT_CONFIRM }: { action: () => Promise<void>; confirmText?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="px-0 underline decoration-line-strong underline-offset-4 hover:decoration-primary">
        Generar un link nuevo
      </Button>
    </form>
  );
}
