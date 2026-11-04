import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-1.5" aria-label="FOTOSQR, inicio">
      <span className="display text-[28px] italic leading-none text-ink">fotos</span>
      <span className="rounded-[5px] bg-primary px-1.5 py-0.5 font-mono text-[12px] font-medium leading-none text-on-paper">QR</span>
    </Link>
  );
}
