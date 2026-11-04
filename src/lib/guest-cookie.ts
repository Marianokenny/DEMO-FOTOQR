import "server-only";
import { cookies, headers } from "next/headers";

export const guestCookieName = (eventId: string) => `fq_g_${eventId}`;

export async function readGuestToken(eventId: string) {
  return (await cookies()).get(guestCookieName(eventId))?.value;
}

export async function writeGuestToken(eventId: string, token: string) {
  (await cookies()).set(guestCookieName(eventId), token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clientInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent") ?? "" };
}
