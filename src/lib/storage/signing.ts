import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config";

/** HMAC signature for the local storage driver's upload/download URLs. */
export function sign(parts: Record<string, string | number>): string {
  const payload = Object.keys(parts).sort().map((k) => `${k}=${parts[k]}`).join("&");
  return createHmac("sha256", config.appSecret).update(payload).digest("base64url");
}

export function verify(parts: Record<string, string | number>, signature: string): boolean {
  const expected = Buffer.from(sign(parts));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
