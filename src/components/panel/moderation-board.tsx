"use client";

import { Check, ChevronLeft, ChevronRight, Loader2, Play, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setAutoApproveAction } from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { MediaItem, StatusFilter } from "@/lib/moderation";

type Counts = { pending: number; approved: number; rejected: number; all: number };
type TypeFilter = "all" | "photo" | "video";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "pending", label: "Pendientes" },
  { id: "approved", label: "Aprobados" },
  { id: "rejected", label: "Rechazados" },
  { id: "all", label: "Todos" },
];

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "recién";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function duration(ms: number | null) {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ModerationBoard({ eventId, initialAutoApprove, canConfigure }: {
  eventId: string; initialAutoApprove: boolean; canConfigure: boolean;
}) {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [type, setType] = useState<TypeFilter>("all");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0, all: 0 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [autoApprove, setAutoApprove] = useState(initialAutoApprove);
  const [busy, setBusy] = useState(false);
  const filterRef = useRef({ status, type });
  filterRef.current = { status, type };

  const load = useCallback(async (append?: string | null) => {
    const { status: s, type: t } = filterRef.current;
    const qs = new URLSearchParams({ status: s, type: t, ...(append ? { cursor: append } : {}) });
    const res = await fetch(`/api/events/${eventId}/media?${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    setCounts(data.counts);
    setCursor(data.nextCursor);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    load();
  }, [status, type, load]);

  // Live updates: refetch (debounced) whenever something changes in this event.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const es = new EventSource(`/api/events/${eventId}/live`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "media.updated" && msg.status === "pending") setFresh((n) => n + 1);
      clearTimeout(timer);
      timer = setTimeout(() => load(), 400);
    };
    return () => { clearTimeout(timer); es.close(); };
  }, [eventId, load]);

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(0), 4000);
    return () => clearTimeout(t);
  }, [fresh]);

  const act = useCallback(async (ids: string[], action: "approve" | "reject" | "delete") => {
    if (!ids.length) return;
    if (action === "delete" && !confirm(ids.length === 1 ? "¿Eliminar este archivo? No se puede deshacer." : `¿Eliminar ${ids.length} archivos? No se puede deshacer.`)) return;
    setBusy(true);
    // Optimistic: drop items that no longer match the current filter.
    const target = action === "approve" ? "approved" : action === "reject" ? "rejected" : "deleted";
    setItems((prev) => prev.flatMap((i) => {
      if (!ids.includes(i.id)) return [i];
      if (action === "delete" || (status !== "all" && status !== target)) return [];
      return [{ ...i, status: target as MediaItem["status"] }];
    }));
    setSelected(new Set());
    await fetch(`/api/events/${eventId}/media/bulk`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids }),
    });
    setBusy(false);
    load();
  }, [eventId, load, status]);

  const current = open !== null ? items[open] : null;

  // Keyboard shortcuts in the full view: A approve, R reject, Supr delete, arrows to move, Esc to close.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") setOpen((o) => (o !== null ? Math.min(items.length - 1, o + 1) : o));
      else if (e.key === "ArrowLeft") setOpen((o) => (o !== null ? Math.max(0, o - 1) : o));
      else if (e.key.toLowerCase() === "a") act([current.id], "approve");
      else if (e.key.toLowerCase() === "r") act([current.id], "reject");
      else if (e.key === "Delete") act([current.id], "delete");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, items.length, act]);

  useEffect(() => {
    if (open !== null && open >= items.length) setOpen(items.length ? items.length - 1 : null);
  }, [items.length, open]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectedIds = useMemo(() => [...selected], [selected]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="-mx-5 flex w-[calc(100%+2.5rem)] items-center gap-2 overflow-x-auto px-5 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id} onClick={() => setStatus(t.id)}
              className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors sm:h-10 sm:px-4", status === t.id ? "border-paper bg-paper font-semibold text-on-paper" : "border-line-strong text-muted hover:text-ink")}
            >
              {t.label} <span className="ml-1 font-mono text-xs opacity-70">{counts[t.id]}</span>
            </button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-line-strong sm:block" />
          {(["all", "photo", "video"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={cn("eyebrow h-9 shrink-0 px-2 sm:h-10", type === t ? "text-primary" : "text-muted hover:text-ink")}>
              {t === "all" ? "Todo" : t === "photo" ? "Fotos" : "Videos"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className={cn("eyebrow inline-flex items-center gap-2", live ? "text-success" : "text-faint")}>
            <span className="relative flex size-1.5">{live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />}<span className="relative size-1.5 rounded-full bg-current" /></span>
            {live ? "En vivo" : "Conectando"}
          </span>
          {canConfigure && (
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <span>Aprobación automática</span>
              <input
                type="checkbox" className="peer sr-only" checked={autoApprove}
                onChange={async (e) => { setAutoApprove(e.target.checked); await setAutoApproveAction(eventId, e.target.checked); }}
              />
              <span className="relative h-7 w-12 rounded-full bg-surface-2 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-muted after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-on-paper" />
            </label>
          )}
        </div>
      </div>

      {autoApprove && (
        <p className="rounded-[10px] border border-primary/40 px-4 py-3 text-sm text-ink">
          Lo que suban los invitados va directo a la pantalla. Podés eliminar cualquier cosa desde acá.
        </p>
      )}

      {status === "pending" && counts.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{counts.pending} esperando tu revisión. Tocá una foto para verla grande.</p>
          <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
            if (!confirm(`¿Aprobar los ${counts.pending} pendientes?`)) return;
            await fetch(`/api/events/${eventId}/media/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approveAllPending" }) });
            load();
          }}>Aprobar todos</Button>
        </div>
      )}

      {fresh > 0 && (
        <div className="fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-paper shadow-xl">
          {fresh === 1 ? "Llegó 1 archivo nuevo" : `Llegaron ${fresh} archivos nuevos`}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-24 text-muted"><Loader2 className="size-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line-strong px-6 py-20 text-center">
          <p className="display text-4xl">{status === "pending" ? <>Nada <em>pendiente</em></> : "Todavía no hay nada acá"}</p>
          <p className="mt-3 text-muted">{status === "pending" ? "Cuando un invitado suba algo, aparece acá al instante." : "Probá con otro filtro."}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((it, idx) => (
            <li key={it.id} className={cn("group overflow-hidden rounded-[12px] border bg-surface transition-colors", selected.has(it.id) ? "border-primary" : "border-line")}>
              <div className="relative aspect-square bg-surface-2">
                <button onClick={() => setOpen(idx)} className="absolute inset-0" aria-label="Ver grande">
                  {it.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-faint"><Loader2 className="size-5 animate-spin" /></span>
                  )}
                </button>
                <label className="absolute left-2 top-2 grid size-7 cursor-pointer place-items-center rounded-full bg-black/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 has-[:checked]:opacity-100">
                  <input type="checkbox" className="peer sr-only" checked={selected.has(it.id)} onChange={() => toggle(it.id)} aria-label="Seleccionar" />
                  <span className="size-4 rounded-full border-2 border-white peer-checked:border-primary peer-checked:bg-primary" />
                </label>
                {it.type === "video" && (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white"><Play className="size-3" /> {duration(it.durationMs)}</span>
                )}
                {it.status !== "pending" && (
                  <span className={cn("eyebrow absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px]",
                    it.status === "approved" ? "bg-success text-on-paper" : it.status === "rejected" ? "bg-danger text-on-paper" : "bg-black/60 text-white")}>
                    {it.status === "approved" ? "En pantalla" : it.status === "rejected" ? "Rechazado" : "Procesando"}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it.senderName ?? "Anónimo"}</p>
                  {it.message && <p className="truncate text-xs italic text-muted" title={it.message}>“{it.message}”</p>}
                  <p className="font-mono text-[11px] text-faint">{ago(it.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {it.status !== "approved" && it.status !== "processing" && (
                    <button onClick={() => act([it.id], "approve")} title="Aprobar (A)" aria-label="Aprobar" className="grid size-8 place-items-center rounded-full bg-primary text-on-paper hover:bg-paper"><Check className="size-4" /></button>
                  )}
                  {it.status !== "rejected" && it.status !== "processing" && (
                    <button onClick={() => act([it.id], "reject")} title="Rechazar (R)" aria-label="Rechazar" className="grid size-8 place-items-center rounded-full border border-line-strong text-muted hover:border-paper hover:text-ink"><X className="size-4" /></button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor && !loading && (
        <div className="flex justify-center"><Button variant="secondary" onClick={() => load(cursor)}>Cargar más</Button></div>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-5 py-4 backdrop-blur pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm"><strong>{selectedIds.length}</strong> seleccionado{selectedIds.length === 1 ? "" : "s"} · <button className="text-muted underline" onClick={() => setSelected(new Set())}>Cancelar</button></span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act(selectedIds, "approve")}>Aprobar</Button>
              <Button size="sm" variant="secondary" onClick={() => act(selectedIds, "reject")}>Rechazar</Button>
              <Button size="sm" variant="danger" onClick={() => act(selectedIds, "delete")}><Trash2 className="size-4" /> Eliminar</Button>
            </div>
          </div>
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal>
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
            <div className="min-w-0">
              <p className="truncate font-semibold">{current.senderName ?? "Anónimo"}</p>
              {current.message && <p className="text-sm italic text-white/80">“{current.message}”</p>}
              <p className="font-mono text-xs text-white/60">{ago(current.createdAt)} · {open! + 1} de {items.length}</p>
            </div>
            <button onClick={() => setOpen(null)} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Cerrar (Esc)"><X className="size-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            {current.type === "video" && current.displayUrl ? (
              <video key={current.id} src={current.displayUrl} poster={current.posterUrl ?? undefined} controls autoPlay playsInline className="max-h-full max-w-full" />
            ) : current.displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.displayUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <Loader2 className="size-8 animate-spin text-white/60" />
            )}
            <button onClick={() => setOpen(Math.max(0, open! - 1))} disabled={open === 0} className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white disabled:opacity-20" aria-label="Anterior"><ChevronLeft /></button>
            <button onClick={() => setOpen(Math.min(items.length - 1, open! + 1))} disabled={open === items.length - 1} className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white disabled:opacity-20" aria-label="Siguiente"><ChevronRight /></button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {current.status !== "approved" && <Button onClick={() => act([current.id], "approve")} disabled={current.status === "processing"}><Check className="size-4" /> Aprobar <kbd className="hidden font-mono text-xs opacity-60 sm:inline">A</kbd></Button>}
            {current.status !== "rejected" && <Button variant="secondary" className="border-white/30 text-white" onClick={() => act([current.id], "reject")} disabled={current.status === "processing"}><X className="size-4" /> Rechazar <kbd className="hidden font-mono text-xs opacity-60 sm:inline">R</kbd></Button>}
            <Button variant="danger" onClick={() => act([current.id], "delete")}><Trash2 className="size-4" /> Eliminar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
