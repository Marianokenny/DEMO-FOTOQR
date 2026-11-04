"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Gallery, GalleryItem } from "@/lib/gallery";

type Filter = "all" | "photo" | "video";

/** Grid + viewer used by the organizer panel and by the public gallery link. */
export function GalleryView({ gallery, zipUrl, manageEventId }: {
  gallery: Gallery;
  /** Base URL of the ZIP download; `?type=photo|video` is added for filtered downloads. */
  zipUrl: string;
  /** When set, the viewer offers "Eliminar" (organizer only). */
  manageEventId?: string;
}) {
  const [items, setItems] = useState(gallery.items);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);
  const visible = useMemo(() => (filter === "all" ? items : items.filter((i) => i.type === filter)), [items, filter]);
  const counts = {
    all: items.length,
    photo: items.filter((i) => i.type === "photo").length,
    video: items.filter((i) => i.type === "video").length,
  };

  async function remove(item: GalleryItem) {
    if (!manageEventId || !confirm("¿Eliminar este archivo? No se puede deshacer.")) return;
    const res = await fetch(`/api/events/${manageEventId}/media/${item.id}`, { method: "DELETE" });
    if (!res.ok) return alert("No se pudo eliminar.");
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    setOpen(null);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-line-strong px-6 py-16 text-center">
        <p className="display text-4xl">Todavía no hay <em className="text-primary">recuerdos</em></p>
        <p className="mx-auto mt-3 max-w-md text-muted">Acá aparece todo lo que se aprueba en la moderación: fotos y videos listos para ver y descargar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filtrar">
          {([["all", "Todo"], ["photo", "Fotos"], ["video", "Videos"]] as const).map(([v, label]) => (
            <button
              key={v} type="button" role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
              className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
                filter === v ? "bg-paper text-on-paper" : "border border-line-strong text-muted hover:text-ink")}
            >
              {label} <span className="ml-1 font-mono text-xs opacity-60">{counts[v]}</span>
            </button>
          ))}
        </div>
        <a
          href={filter === "all" ? zipUrl : `${zipUrl}?type=${filter}`}
          className={buttonClass("primary", "md")}
          download
        >
          Descargar {filter === "all" ? "todo" : filter === "photo" ? "las fotos" : "los videos"} (ZIP) ↓
        </a>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-muted">No hay {filter === "photo" ? "fotos" : "videos"} todavía.</p>
      ) : (
        <ul className="columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4 xl:columns-5" data-testid="gallery-grid">
          {visible.map((item, i) => (
            <li key={item.id} className="mb-2 break-inside-avoid sm:mb-3">
              <button
                type="button" onClick={() => setOpen(i)}
                className="group relative block w-full overflow-hidden rounded-[10px] bg-surface focus-visible:outline-2 focus-visible:outline-primary"
                style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : "1" }}
                aria-label={`Ver ${item.type === "video" ? "video" : "foto"}${item.senderName ? ` de ${item.senderName}` : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                {item.type === "video" && (
                  <span className="absolute left-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-xs text-white">▶</span>
                )}
                {item.senderName && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-3 py-1.5 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {item.senderName}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open !== null && visible[open] && (
        <Viewer
          items={visible} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          onDelete={manageEventId ? remove : undefined}
        />
      )}
    </div>
  );
}

function Viewer({ items, index, onIndex, onClose, onDelete }: {
  items: GalleryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void; onDelete?: (item: GalleryItem) => void;
}) {
  const item = items[index];
  const prev = useCallback(() => onIndex((index - 1 + items.length) % items.length), [index, items.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % items.length), [index, items.length, onIndex]);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose, prev, next]);

  async function share() {
    try {
      const blob = await (await fetch(item.downloadUrl)).blob();
      const file = new File([blob], item.type === "video" ? "video.mp4" : "foto.jpg", { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    } catch { /* cancelled or not supported */ }
  }
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Visor"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-paper"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
        setTouchX(null);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="min-w-0 truncate text-sm">
          <span className="font-mono text-faint">{index + 1}/{items.length}</span>
          {item.senderName && <span className="ml-3">{item.senderName}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {canShare && <button type="button" onClick={share} className={buttonClass("secondary", "sm")}>Compartir</button>}
          <a href={item.downloadUrl} download className={buttonClass("primary", "sm")}>Descargar ↓</a>
          {onDelete && <button type="button" onClick={() => onDelete(item)} className={buttonClass("danger", "sm")}>Eliminar</button>}
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-lg hover:bg-white/10">✕</button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {item.type === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.id} src={item.viewUrl} alt="" className="absolute inset-0 size-full object-contain p-2 sm:p-6" />
        ) : (
          <video key={item.id} src={item.viewUrl} poster={item.posterUrl ?? undefined} controls autoPlay playsInline className="absolute inset-0 size-full object-contain p-2 sm:p-6" />
        )}
        {items.length > 1 && (
          <>
            <button type="button" onClick={prev} aria-label="Anterior" className="absolute left-2 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl hover:bg-white/15 sm:grid">←</button>
            <button type="button" onClick={next} aria-label="Siguiente" className="absolute right-2 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl hover:bg-white/15 sm:grid">→</button>
          </>
        )}
      </div>
    </div>
  );
}
