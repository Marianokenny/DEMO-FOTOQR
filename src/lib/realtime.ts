import { redis } from "./redis";

export type RealtimeMessage =
  | { type: "media.created"; mediaId: string }
  | { type: "media.updated"; mediaId: string; status: string }
  | { type: "media.removed"; mediaId: string }
  | { type: "settings.updated" }
  | { type: "control"; command: ScreenCommand }
  | { type: "screen.now"; nowId: string | null; nextId: string | null; paused: boolean; pinnedId: string | null };

export type ScreenCommand =
  | { kind: "playNow"; mediaId: string }
  | { kind: "pin"; mediaId: string }
  | { kind: "unpin" }
  | { kind: "skip" }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "qr" }
  | { kind: "leaderboard" }
  | { kind: "winner"; winner: { name: string; count: number; thumbUrl: string | null } | null }
  | { kind: "selfie"; startedAt: string; endsAt: string; text: string };

export type GuestMessage =
  | { type: "upcoming"; mediaId: string; thumbUrl: string | null }
  | { type: "onscreen"; mediaId: string; thumbUrl: string | null };

export const guestChannel = (guestSessionId: string) => `guest:${guestSessionId}`;

export async function publishToGuest(guestSessionId: string, message: GuestMessage) {
  await redis().publish(guestChannel(guestSessionId), JSON.stringify(message));
}

export const eventChannel = (eventId: string) => `event:${eventId}`;

export async function publish(eventId: string, message: RealtimeMessage) {
  await redis().publish(eventChannel(eventId), JSON.stringify(message));
}
