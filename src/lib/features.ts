import { z } from "zod";

/** What the robot mascot can do when it shows up over a photo. */
export const ROBOT_MOVES = ["wave", "photo", "dance", "love", "peek"] as const;
export type RobotMove = (typeof ROBOT_MOVES)[number];
export const ROBOT_MOVE_LABELS: Record<RobotMove, { label: string; emoji: string; line: string }> = {
  wave: { label: "Saluda", emoji: "👋", line: "¡Holaaa!" },
  photo: { label: "Saca foto", emoji: "📸", line: "¡Qué fotón!" },
  dance: { label: "Baila", emoji: "🕺", line: "¡A bailar!" },
  love: { label: "Corazones", emoji: "💛", line: "¡Me encanta!" },
  peek: { label: "Se asoma", emoji: "👀", line: "¿Quién sacó esta?" },
};

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
  robot: z.object({
    /** Surprise cameos over random photos. Photos the organizer marks always get one. */
    enabled: z.boolean().default(true),
    every: z.number().int().min(2).max(50).default(6),
    moves: z.array(z.enum(ROBOT_MOVES)).min(1).max(ROBOT_MOVES.length).default([...ROBOT_MOVES]),
    /** Speech bubble; empty = a different line for each move. */
    text: z.string().trim().max(40).default(""),
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
