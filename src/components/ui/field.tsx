import { cn } from "@/lib/cn";

const control =
  "w-full h-12 rounded-[10px] border border-line-strong bg-bg-elevated px-4 text-[15px] text-ink placeholder:text-faint outline-none transition-colors focus:border-primary";

export function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="eyebrow block text-muted">{label}</span>
      {children}
      {error ? <span className="block text-[13px] text-danger">{error}</span> : hint ? <span className="block text-[13px] text-faint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M2 4l4 4 4-4%22 fill=%22none%22 stroke=%22%23a39c90%22 stroke-width=%221.5%22/></svg>')] bg-[right_1rem_center] bg-no-repeat pr-10", className)} {...props} />;
}
