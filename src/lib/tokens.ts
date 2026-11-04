import { createHash, randomBytes } from "node:crypto";

/** Random URL-safe token. 16 bytes = 128 bits of entropy by default. */
export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
