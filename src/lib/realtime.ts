import { redis } from "./redis";

export type RealtimeMessage =
  | { type: "media.created"; mediaId: string }
  | { type: "media.updated"; mediaId: string; status: string }
  | { type: "media.removed"; mediaId: string }
  | { type: "settings.updated" };

export const eventChannel = (eventId: string) => `event:${eventId}`;

export async function publish(eventId: string, message: RealtimeMessage) {
  await redis().publish(eventChannel(eventId), JSON.stringify(message));
}
