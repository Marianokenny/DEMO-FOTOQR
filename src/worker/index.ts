import { Worker } from "bullmq";
import { db } from "../lib/db";
import { processMedia } from "../lib/media/process";
import { MEDIA_QUEUE, type MediaJob } from "../lib/queue";
import { newRedisConnection } from "../lib/redis";

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 3);

const worker = new Worker<MediaJob>(
  MEDIA_QUEUE,
  async (job) => processMedia(job.data.mediaId),
  { connection: newRedisConnection(), concurrency },
);

worker.on("completed", (job, result) => console.log(`[media] ${job.data.mediaId} →`, JSON.stringify(result)));
worker.on("failed", async (job, err) => {
  console.error(`[media] ${job?.data.mediaId} error:`, err.message);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await db.media.update({ where: { id: job.data.mediaId }, data: { status: "failed", failReason: "internal" } }).catch(() => {});
  }
});

console.log(`[media] worker listo (concurrencia ${concurrency})`);

async function shutdown() {
  await worker.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
