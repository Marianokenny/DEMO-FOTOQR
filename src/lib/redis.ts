import IORedis from "ioredis";
import { config } from "./config";

const g = globalThis as unknown as { redis?: IORedis };

/** Shared connection for commands (rate limits, publishing). BullMQ and subscribers open their own. */
export function redis(): IORedis {
  g.redis ??= new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  return g.redis;
}

export function newRedisConnection(): IORedis {
  return new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
}
