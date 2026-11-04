import { notFound } from "next/navigation";
import { PrintButton } from "@/components/panel/print-button";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getActiveLink, linkUrl } from "@/lib/links";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { qrSvg } from "@/lib/qr";

export const metadata = { title: "Cartel para imprimir" };

/** A4 poster for tables and entrances. Printed from the browser ("Guardar como PDF" also works). */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await can(user, id, "view"))) notFound();
  const event = await db.event.findUniqueOrThrow({ where: { id } });
  const link = await getActiveLink(id, "upload");
  if (!link) notFound();
  const url = linkUrl("upload", link.token);
  const svg = await qrSvg(url);

  return (
    <main className="min-h-dvh bg-surface-2 py-8 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0 } @media print { body::before { display: none } }`}</style>
      <div className="mx-auto mb-6 flex max-w-[210mm] justify-end px-4 print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto flex h-[297mm] w-[210mm] flex-col items-center justify-between bg-paper px-[18mm] py-[20mm] text-center text-on-paper shadow-2xl print:shadow-none">
        <header>
          <p className="eyebrow text-on-paper-muted">{formatDate(event.date, { day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="display mt-4 text-[64px]">{event.name}</h1>
        </header>
        <div>
          <p className="display text-[56px] leading-none">Escaneá y <em className="text-primary">compartí</em></p>
          <p className="mt-4 text-xl text-on-paper-muted">tus fotos y videos de la fiesta</p>
          <div className="mx-auto mt-10 w-[110mm] rounded-[16px] bg-white p-4 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-6 text-lg">Sin app y sin registrarte. <strong>Salen en la pantalla grande.</strong></p>
        </div>
        <footer className="flex items-baseline gap-1.5 text-on-paper-muted">
          <span className="display text-2xl italic">fotos</span>
          <span className="rounded-[4px] bg-primary px-1 font-mono text-[11px] text-on-paper">QR</span>
        </footer>
      </article>
    </main>
  );
}
