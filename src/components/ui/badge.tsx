import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "primary" | "danger";
const tones: Record<Tone, string> = {
  neutral: "text-muted",
  success: "text-success",
  warning: "text-warning",
  primary: "text-primary",
  danger: "text-danger",
};

export function Badge({ tone = "neutral", dot, pulse, className, children }: {
  tone?: Tone; dot?: boolean; pulse?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <span className={cn("eyebrow inline-flex items-center gap-2 rounded-full border border-current/30 px-2.5 py-1", tones[tone], className)}>
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />}
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
