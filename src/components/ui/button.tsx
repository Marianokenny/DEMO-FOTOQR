import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-paper hover:bg-paper",
  secondary: "border border-line-strong text-ink hover:border-paper hover:bg-paper hover:text-on-paper",
  ghost: "text-muted hover:text-ink",
  danger: "border border-danger/50 text-danger hover:bg-danger hover:text-on-paper",
  dark: "bg-on-paper text-paper hover:bg-primary hover:text-on-paper",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Arrow that nudges right on hover; use inside a button. */
export function Arrow() {
  return <span aria-hidden className="transition-transform duration-150 group-hover/btn:translate-x-0.5">→</span>;
}
