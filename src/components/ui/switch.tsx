export function Switch({ name, defaultChecked, checked, onChange, label, hint }: {
  name?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[10px] border border-line-strong px-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox" name={name} className="peer sr-only"
        {...(checked !== undefined ? { checked, onChange: (e) => onChange?.(e.target.checked) } : { defaultChecked })}
      />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-muted after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-on-paper" />
    </label>
  );
}
