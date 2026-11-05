import type { User } from "@prisma/client";
import { z } from "zod";
import { readAppearance, type Appearance } from "./appearance";
import { readFeatures, type Features } from "./features";
import { getLive, leaderboard, type LiveState } from "./live";
import { db } from "./db";
import { getActiveLink, linkUrl, resolveLink } from "./links";
import { assertCan } from "./permissions";
import { publish } from "./realtime";
import { storage } from "./storage";

const SCREEN_URL_TTL = 12 * 3600; // the screen refreshes its state well before this

export const projectionSettingsSchema = z.object({
  enabled: z.boolean(),
  expiresAt: z.date().nullable(),
  photoSeconds: z.number().int().min(3).max(60),
  videoMode: z.enum(["full", "capped"]),
  videoMaxSeconds: z.number().int().min(5).max(300),
  videoMuted: z.boolean(),
  transition: z.enum(["fade", "slide", "zoom"]),
  playOrder: z.enum(["newest_first", "chronological", "random"]),
  showSenderName: z.boolean(),
});

export type ProjectionSettingsInput = z.infer<typeof projectionSettingsSchema>;

export type ScreenItem = {
  id: string; type: "photo" | "video"; url: string; posterUrl: string | null;
  senderName: string | null; message: string | null; robot: string | null; durationMs: number | null; width: number | null; height: number | null; approvedAt: string;
};

export type ScreenState = {
  on: boolean;
  reason: "on" | "off" | "expired";
  event: { name: string; color: string };
  uploadUrl: string | null;
  settings: Omit<ProjectionSettingsInput, "enabled" | "expiresAt"> & { version: number };
  appearance: Appearance;
  features: Features;
  live: LiveState;
  leaderboard: { name: string; count: number }[];
  assets: Record<string, string>;
  items: ScreenItem[];
  generatedAt: string;
};

export async function updateProjectionSettings(user: Pick<User, "id" | "role">, eventId: string, input: Partial<ProjectionSettingsInput>) {
  await assertCan(user, eventId, "configure");
  const updated = await db.projectionSettings.update({ where: { eventId }, data: { ...input, version: { increment: 1 } } });
  await publish(eventId, { type: "settings.updated" });
  return updated;
}

/** Everything the projection screen needs, with signed URLs. Approved content only. */
export async function getScreenState(token: string): Promise<ScreenState> {
  const link = await resolveLink(token, "screen");
  return buildScreenState(link.eventId);
}

export async function buildScreenState(eventId: string): Promise<ScreenState> {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: { projectionSettings: true, assets: true } });
  const s = event.projectionSettings!;
  const expired = !!s.expiresAt && s.expiresAt.getTime() < Date.now();
  const on = s.enabled && !expired;
  const media = on
    ? await db.media.findMany({ where: { eventId, status: "approved" }, orderBy: { approvedAt: "asc" }, take: 2000 })
    : [];
  const st = storage();
  const items: ScreenItem[] = await Promise.all(media.filter((m) => m.displayKey).map(async (m) => ({
    id: m.id, type: m.type, url: await st.presignDownload(m.displayKey!, SCREEN_URL_TTL),
    posterUrl: m.posterKey ? await st.presignDownload(m.posterKey, SCREEN_URL_TTL) : null,
    senderName: m.senderName, message: m.message, robot: m.robotMove, durationMs: m.durationMs, width: m.width, height: m.height,
    approvedAt: (m.approvedAt ?? m.createdAt).toISOString(),
  })));
  const assets: Record<string, string> = {};
  for (const a of event.assets) assets[a.id] = await st.presignDownload(a.key, SCREEN_URL_TTL);
  const upload = await getActiveLink(eventId, "upload");
  const uploadOpen = upload && (!upload.expiresAt || upload.expiresAt.getTime() > Date.now());
  return {
    on,
    reason: on ? "on" : expired ? "expired" : "off",
    event: { name: event.name, color: event.brandColor },
    uploadUrl: uploadOpen ? linkUrl("upload", upload.token) : null,
    settings: {
      photoSeconds: s.photoSeconds, videoMode: s.videoMode, videoMaxSeconds: s.videoMaxSeconds, videoMuted: s.videoMuted,
      transition: s.transition as "fade" | "slide" | "zoom", playOrder: s.playOrder, showSenderName: s.showSenderName, version: s.version,
    },
    appearance: readAppearance(s.appearance),
    features: readFeatures(s.features),
    live: await getLive(eventId),
    leaderboard: on ? (await leaderboard(eventId)).map(({ name, count }) => ({ name, count })) : [],
    assets,
    items,
    generatedAt: new Date().toISOString(),
  };
}
