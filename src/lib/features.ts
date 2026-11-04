import { z } from "zod";

/** Extra show features for the projection screen. Stored as JSON on projection_settings.features. */
export const featuresSchema = z.object({
  qrBreak: z.object({
    enabled: z.boolean().default(true),
    every: z.number().int().min(2).max(100).default(8),
    seconds: z.number().int().min(4).max(60).default(10),
    text: z.string().trim().max(60).default("¡Subí tu foto!"),
  }).default({}),
  captions: z.object({
    enabled: z.boolean().default(true),
  }).default({}),
  leaderboard: z.object({
    enabled: z.boolean().default(false),
    every: z.number().int().min(5).max(200).default(25),
    seconds: z.number().int().min(5).max(60).default(12),
  }).default({}),
  selfie: z.object({
    /** Local time "HH:MM" (Argentina) for the surprise selfie; empty = only when triggered by hand. */
    at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")).default(""),
    collectSeconds: z.number().int().min(30).max(300).default(90),
    text: z.string().trim().max(60).default("¡Todos sacan selfie YA!"),
  }).default({}),
  beat: z.object({
    enabled: z.boolean().default(false),
    bpm: z.number().int().min(60).max(200).default(124),
    beatsPerPhoto: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).default(4),
  }).default({}),
});

export type Features = z.infer<typeof featuresSchema>;

export function readFeatures(raw: unknown): Features {
  const parsed = featuresSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : featuresSchema.parse({});
}

/** Seconds a photo stays on screen when the beat mode is on. */
export function beatPhotoMs(beat: Features["beat"]) {
  return Math.round((60_000 / beat.bpm) * beat.beatsPerPhoto);
}
