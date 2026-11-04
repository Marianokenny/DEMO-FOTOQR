import { redis } from "./redis";

/** Fixed-window counter. Returns false once `limit` units were used in the window. */
export async function consume(key: string, units: number, limit: number, windowSeconds: number): Promise<boolean> {
  const k = `rl:${key}`;
  const total = await redis().incrby(k, units);
  if (total === units) await redis().expire(k, windowSeconds);
  return total <= limit;
}
