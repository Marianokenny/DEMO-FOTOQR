import { Queue } from "bullmq";
import { newRedisConnection } from "./redis";

export const MEDIA_QUEUE = "media";
export type MediaJob = { mediaId: string };

const g = globalThis as unknown as { mediaQueue?: Queue<MediaJob> };

export function mediaQueue(): Queue<MediaJob> {
  g.mediaQueue ??= new Queue<MediaJob>(MEDIA_QUEUE, {
    connection: newRedisConnection(),
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  });
  return g.mediaQueue;
}

export async function enqueueMediaProcessing(mediaId: string) {
  await mediaQueue().add("process", { mediaId }, { jobId: mediaId });
}
