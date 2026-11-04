import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const colorOrNone = z.union([hex, z.literal("transparent")]);

export const FONTS = ["Instrument Serif", "Bricolage Grotesque", "Playfair Display", "Great Vibes", "Bebas Neue", "Montserrat"] as const;

export const layerSchema = z.object({
  id: z.string().max(40),
  assetId: z.string().max(40),
  opacity: z.number().min(0).max(1).default(1),
  brightness: z.number().min(0).max(2).default(1),
  blend: z.enum(["normal", "screen", "multiply", "overlay", "soft-light"]).default("normal"),
  fit: z.enum(["cover", "contain"]).default("cover"),
  visible: z.boolean().default(true),
});

/** Everything the appearance editor controls. Stored as JSON on projection_settings.appearance. */
export const appearanceSchema = z.object({
  background: z.object({
    color: hex.default("#0f0e0c"),
    assetId: z.string().max(40).nullable().default(null),
    brightness: z.number().min(0).max(2).default(1),
  }).default({}),
  layers: z.array(layerSchema).max(8).default([]),
  waitingText: z.object({
    enabled: z.boolean().default(true),
    text: z.string().max(120).default("Subí tu foto o video"),
    font: z.enum(FONTS).default("Instrument Serif"),
    size: z.number().int().min(24).max(200).default(96),
    color: hex.default("#F3ECE0"),
    background: colorOrNone.default("transparent"),
    showQr: z.boolean().default(true),
  }).default({}),
  sender: z.object({
    color: hex.default("#F3ECE0"),
    background: colorOrNone.default("#15120E"),
    position: z.enum(["bottom-left", "bottom-center", "bottom-right"]).default("bottom-left"),
  }).default({}),
  media: z.object({
    fit: z.enum(["contain", "cover"]).default("contain"),
    blurFill: z.boolean().default(true),
  }).default({}),
});

export type Appearance = z.infer<typeof appearanceSchema>;

/** Parses stored JSON, filling every missing field with its default. Never throws. */
export function readAppearance(raw: unknown): Appearance {
  const parsed = appearanceSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : appearanceSchema.parse({});
}
