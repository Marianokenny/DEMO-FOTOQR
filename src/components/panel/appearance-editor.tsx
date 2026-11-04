"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setShowSenderNameAction } from "@/app/actions/projection";
import { Backdrop, FONT_VARS, SenderTag, WaitingScreen } from "@/components/screen/projection-player";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { appearanceSchema, FONTS, type Appearance } from "@/lib/appearance";
import { cn } from "@/lib/cn";

type AssetInfo = { id: string; usage: string; url: string; width: number | null; height: number | null };
type Layer = Appearance["layers"][number];

const MAX_LAYERS = 8;
const SAVE_DELAY_MS = 700;

const BLENDS: Record<Layer["blend"], string> = {
  normal: "Normal", screen: "Aclarar", multiply: "Oscurecer", overlay: "Superponer", "soft-light": "Luz suave",
};

export function AppearanceEditor({ eventId, initial, initialAssets, showSenderName: initialShowSender, event, uploadUrl, sample, screenHref }: {
  eventId: string;
  initial: Appearance;
  initialAssets: AssetInfo[];
  showSenderName: boolean;
  event: { name: string; color: string };
  uploadUrl: string | null;
  sample: { url: string; senderName: string | null } | null;
  screenHref: string | null;
}) {
  const [a, setA] = useState(initial);
  const [assets, setAssets] = useState(initialAssets);
  const [showSender, setShowSender] = useState(initialShowSender);
  const [view, setView] = useState<"waiting" | "photo">("waiting");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const first = useRef(true);
  const assetMap = Object.fromEntries(assets.map((x) => [x.id, x.url]));

  // Autosave: every change is sent shortly after the last edit; the open screen updates itself.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus("saving");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/appearance`, {
          method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(a), signal: ctrl.signal,
        });
        setStatus(res.ok ? "saved" : "error");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, SAVE_DELAY_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [a, eventId]);

  const set = <K extends keyof Appearance>(key: K, patch: Partial<Appearance[K]>) =>
    setA((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } }));
  const setLayer = (id: string, patch: Partial<Layer>) =>
    setA((prev) => ({ ...prev, layers: prev.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  async function upload(file: File, usage: "background" | "layer"): Promise<AssetInfo | null> {
    setError(null);
    setBusy(usage);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("usage", usage);
      const res = await fetch(`/api/events/${eventId}/assets`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? "No se pudo subir la imagen."); return null; }
      const asset: AssetInfo = { id: data.id, usage, url: data.url, width: data.width, height: data.height };
      setAssets((prev) => [...prev, asset]);
      return asset;
    } catch {
      setError("No se pudo subir la imagen. Revisá la conexión.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function removeAsset(assetId: string) {
    setAssets((prev) => prev.filter((x) => x.id !== assetId));
    await fetch(`/api/events/${eventId}/assets/${assetId}`, { method: "DELETE" }).catch(() => {});
  }

  async function onBackgroundFile(file: File) {
    const old = a.background.assetId;
    const asset = await upload(file, "background");
    if (!asset) return;
    set("background", { assetId: asset.id });
    if (old) void removeAsset(old);
  }

  function clearBackground() {
    const old = a.background.assetId;
    set("background", { assetId: null, brightness: 1 });
    if (old) void removeAsset(old);
  }

  async function onLayerFile(file: File) {
    const asset = await upload(file, "layer");
    if (!asset) return;
    const layer: Layer = { id: crypto.randomUUID().slice(0, 12), assetId: asset.id, opacity: 1, brightness: 1, blend: "normal", fit: "cover", visible: true };
    setA((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
  }

  function deleteLayer(layer: Layer) {
    setA((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== layer.id) }));
    void removeAsset(layer.assetId);
  }

  function moveLayer(id: string, dir: -1 | 1) {
    setA((prev) => {
      const i = prev.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.layers.length) return prev;
      const layers = [...prev.layers];
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...prev, layers };
    });
  }

  function resetStyle() {
    const d = appearanceSchema.parse({});
    setA((prev) => ({ ...d, background: { ...d.background, assetId: prev.background.assetId, brightness: prev.background.brightness }, layers: prev.layers }));
  }

  function toggleSender(v: boolean) {
    setShowSender(v);
    startTransition(() => setShowSenderNameAction(eventId, v));
  }

  const bgUrl = a.background.assetId ? assetMap[a.background.assetId] : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* Controls */}
      <div className="order-2 space-y-6 lg:order-1">
        {error && <p role="alert" className="rounded-[10px] border border-danger/50 px-4 py-3 text-sm text-danger">{error}</p>}

        <Card>
          <CardTitle className="mb-5">Fondo</CardTitle>
          <div className="space-y-5">
            <ColorField label="Color de fondo" value={a.background.color} onChange={(color) => set("background", { color })} />
            <div className="space-y-3">
              <span className="eyebrow block text-muted">Imagen de fondo</span>
              {bgUrl ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bgUrl} alt="" className="h-16 w-28 rounded-[8px] border border-line object-cover" />
                  <div className="flex flex-wrap gap-2">
                    <FileButton label="Reemplazar" busy={busy === "background"} onFile={onBackgroundFile} />
                    <button type="button" className={buttonClass("danger", "sm")} onClick={clearBackground}>Quitar</button>
                  </div>
                </div>
              ) : (
                <FileButton label="Subir imagen" busy={busy === "background"} onFile={onBackgroundFile} primary />
              )}
            </div>
            {bgUrl && <Range label="Brillo de la imagen" value={a.background.brightness} min={0} max={1.5} step={0.05} percent onChange={(brightness) => set("background", { brightness })} />}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center justify-between gap-4">
            <CardTitle>Capas</CardTitle>
            <span className="font-mono text-xs text-faint">{a.layers.length}/{MAX_LAYERS}</span>
          </div>
          <p className="mb-4 text-sm text-muted">Marcos, logos o texturas que van encima del fondo y debajo de las fotos. Un PNG con transparencia funciona mejor.</p>
          <ul className="space-y-4">
            {a.layers.map((l, i) => (
              <li key={l.id} className={cn("rounded-[12px] border border-line-strong p-4", !l.visible && "opacity-60")}>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetMap[l.assetId]} alt="" className="size-12 rounded-[6px] bg-[repeating-conic-gradient(#2a2622_0%_25%,#1c1916_0%_50%)] bg-[length:12px_12px] object-contain" />
                  <span className="flex-1 font-medium">Capa {i + 1}</span>
                  <IconButton label="Subir" disabled={i === 0} onClick={() => moveLayer(l.id, -1)}>↑</IconButton>
                  <IconButton label="Bajar" disabled={i === a.layers.length - 1} onClick={() => moveLayer(l.id, 1)}>↓</IconButton>
                  <IconButton label={l.visible ? "Ocultar" : "Mostrar"} onClick={() => setLayer(l.id, { visible: !l.visible })}>{l.visible ? "◉" : "○"}</IconButton>
                  <IconButton label="Eliminar capa" onClick={() => deleteLayer(l)} danger>✕</IconButton>
                </div>
                <div className="mt-4 space-y-4">
                  <Range label="Opacidad" value={l.opacity} min={0} max={1} step={0.05} percent onChange={(opacity) => setLayer(l.id, { opacity })} />
                  <Range label="Brillo" value={l.brightness} min={0} max={1.5} step={0.05} percent onChange={(brightness) => setLayer(l.id, { brightness })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Mezcla">
                      <Select value={l.blend} onChange={(e) => setLayer(l.id, { blend: e.target.value as Layer["blend"] })}>
                        {Object.entries(BLENDS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Tamaño">
                      <Select value={l.fit} onChange={(e) => setLayer(l.id, { fit: e.target.value as Layer["fit"] })}>
                        <option value="cover">Cubrir</option>
                        <option value="contain">Entera</option>
                      </Select>
                    </Field>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {a.layers.length < MAX_LAYERS && (
            <div className={cn(a.layers.length > 0 && "mt-4")}>
              <FileButton label="Agregar capa" busy={busy === "layer"} onFile={onLayerFile} primary={a.layers.length === 0} />
            </div>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-5">Texto de espera</CardTitle>
          <div className="space-y-5">
            <Switch checked={a.waitingText.enabled} onChange={(enabled) => set("waitingText", { enabled })} label="Mostrar texto" hint="Aparece cuando todavía no hay fotos aprobadas." />
            {a.waitingText.enabled && (
              <>
                <Field label="Mensaje">
                  <Input value={a.waitingText.text} maxLength={120} onChange={(e) => set("waitingText", { text: e.target.value })} placeholder="Subí tu foto o video" />
                </Field>
                <div className="space-y-2">
                  <span className="eyebrow block text-muted">Tipografía</span>
                  <div className="grid grid-cols-2 gap-2">
                    {FONTS.map((f) => (
                      <button
                        key={f} type="button" onClick={() => set("waitingText", { font: f })}
                        className={cn("h-14 truncate rounded-[10px] border px-3 text-xl transition-colors",
                          a.waitingText.font === f ? "border-primary bg-primary-soft text-ink" : "border-line-strong text-muted hover:text-ink")}
                        style={{ fontFamily: FONT_VARS[f] }}
                        aria-pressed={a.waitingText.font === f}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <Range label="Tamaño" value={a.waitingText.size} min={24} max={200} step={2} onChange={(size) => set("waitingText", { size })} />
                <ColorField label="Color del texto" value={a.waitingText.color} onChange={(color) => set("waitingText", { color })} />
                <ColorField label="Fondo del texto" value={a.waitingText.background} allowNone onChange={(background) => set("waitingText", { background })} />
              </>
            )}
            <Switch checked={a.waitingText.showQr} onChange={(showQr) => set("waitingText", { showQr })} label="Mostrar el QR para subir fotos" />
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-5">Nombre de quien la envió</CardTitle>
          <div className="space-y-5">
            <Switch checked={showSender} onChange={toggleSender} label="Mostrar el nombre" hint="Solo si el invitado lo escribió al subir." />
            {showSender && (
              <>
                <Field label="Posición">
                  <Select value={a.sender.position} onChange={(e) => set("sender", { position: e.target.value as Appearance["sender"]["position"] })}>
                    <option value="bottom-left">Abajo a la izquierda</option>
                    <option value="bottom-center">Abajo al centro</option>
                    <option value="bottom-right">Abajo a la derecha</option>
                  </Select>
                </Field>
                <ColorField label="Color del nombre" value={a.sender.color} onChange={(color) => set("sender", { color })} />
                <ColorField label="Fondo del nombre" value={a.sender.background} allowNone onChange={(background) => set("sender", { background })} />
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-5">Fotos y videos</CardTitle>
          <div className="space-y-5">
            <Field label="Cómo se acomodan">
              <Select value={a.media.fit} onChange={(e) => set("media", { fit: e.target.value as Appearance["media"]["fit"] })}>
                <option value="contain">Enteras, sin recortar</option>
                <option value="cover">Llenando la pantalla (recorta bordes)</option>
              </Select>
            </Field>
            {a.media.fit === "contain" && (
              <Switch checked={a.media.blurFill} onChange={(blurFill) => set("media", { blurFill })} label="Rellenar con la foto desenfocada" hint="Si está apagado, se ve el fondo detrás de las fotos verticales." />
            )}
          </div>
        </Card>

        <button type="button" onClick={resetStyle} className={buttonClass("ghost", "sm")}>Restablecer textos y colores</button>
      </div>

      {/* Live preview */}
      <div className="order-1 space-y-4 lg:sticky lg:top-6 lg:order-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full border border-line-strong p-1" role="tablist" aria-label="Vista previa">
            {([["waiting", "Sin fotos"], ["photo", "Con una foto"]] as const).map(([v, label]) => (
              <button
                key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={cn("h-9 rounded-full px-4 text-sm font-semibold transition-colors", view === v ? "bg-paper text-on-paper" : "text-muted hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>
          <SaveStatus status={status} />
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-[14px] border border-line bg-black [container-type:size]" data-testid="preview">
          <Backdrop appearance={a} assets={assetMap} />
          {view === "photo" ? (
            <SamplePhoto appearance={a} sample={sample} showSender={showSender} />
          ) : (
            <WaitingScreen appearance={a} event={event} uploadUrl={uploadUrl} reason="on" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Vista previa en 16:9, como un televisor o proyector.</span>
          {screenHref && <a href={screenHref} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-primary">Abrir la pantalla real ↗</a>}
        </div>
      </div>
    </div>
  );
}

function SamplePhoto({ appearance, sample, showSender }: { appearance: Appearance; sample: { url: string; senderName: string | null } | null; showSender: boolean }) {
  const fit = appearance.media.fit;
  if (!sample) {
    return (
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-[70cqh] w-[40cqh] place-items-center rounded-[1cqh] bg-paper/90 text-center font-mono text-[2cqh] uppercase tracking-[0.2em] text-on-paper-muted">
          Foto de<br />ejemplo
        </div>
        {showSender && <SenderTag name="Invitado" appearance={appearance} />}
      </div>
    );
  }
  return (
    <div className="absolute inset-0">
      {appearance.media.blurFill && fit === "contain" && (
        <div className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-[3cqh] brightness-50" style={{ backgroundImage: `url("${sample.url}")` }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sample.url} alt="" className="absolute inset-0 size-full" style={{ objectFit: fit }} />
      {showSender && <SenderTag name={sample.senderName ?? "Invitado"} appearance={appearance} />}
    </div>
  );
}

function SaveStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  const text = { idle: "Los cambios se guardan solos", saving: "Guardando…", saved: "Guardado · ya está en la pantalla", error: "No se pudo guardar. Probá de nuevo." }[status];
  return (
    <span className={cn("eyebrow flex items-center gap-2", status === "error" ? "text-danger" : "text-muted")} aria-live="polite">
      <span className={cn("size-2 rounded-full", status === "saving" ? "animate-pulse bg-warning" : status === "saved" ? "bg-success" : status === "error" ? "bg-danger" : "bg-faint")} />
      {text}
    </span>
  );
}

function Range({ label, value, min, max, step, percent, onChange }: {
  label: string; value: number; min: number; max: number; step: number; percent?: boolean; onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between">
        <span className="eyebrow text-muted">{label}</span>
        <span className="font-mono text-sm text-ink">{percent ? `${Math.round(value * 100)}%` : value}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[var(--primary)]"
      />
    </label>
  );
}

function ColorField({ label, value, allowNone, onChange }: {
  label: string; value: string; allowNone?: boolean; onChange: (v: string) => void;
}) {
  const none = value === "transparent";
  const lastColor = useRef(none ? "#15120E" : value);
  if (!none) lastColor.current = value;
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="space-y-2">
      <span className="eyebrow block text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="color" aria-label={label} value={none ? lastColor.current : value} disabled={none}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] border border-line-strong bg-transparent p-1 disabled:opacity-30"
        />
        <Input
          value={none ? "Sin fondo" : draft} disabled={none} maxLength={7} className="h-11 font-mono uppercase"
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
        />
        {allowNone && (
          <button
            type="button" onClick={() => onChange(none ? lastColor.current : "transparent")}
            className={cn("h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors", none ? "border-primary text-primary" : "border-line-strong text-muted hover:text-ink")}
          >
            {none ? "Con fondo" : "Sin fondo"}
          </button>
        )}
      </div>
    </div>
  );
}

function FileButton({ label, busy, primary, onFile }: { label: string; busy: boolean; primary?: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={buttonClass(primary ? "primary" : "secondary", "sm")}>
        {busy ? "Subiendo…" : label}
      </button>
      <input
        ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid={`file-${label}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </>
  );
}

function IconButton({ label, disabled, danger, onClick, children }: { label: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={cn("grid size-8 place-items-center rounded-full text-sm transition-colors disabled:opacity-30",
        danger ? "text-muted hover:bg-danger hover:text-on-paper" : "text-muted hover:bg-surface-2 hover:text-ink")}
    >
      {children}
    </button>
  );
}
