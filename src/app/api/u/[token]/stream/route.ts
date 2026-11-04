import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { readGuestToken } from "@/lib/guest-cookie";
import { resolveLink } from "@/lib/links";
import { guestChannel } from "@/lib/realtime";
import { channelStream } from "@/lib/sse";
import { sha256 } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live channel for one guest's phone: "your photo is next" and "your photo is on screen". */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const link = await resolveLink((await params).token, "upload");
    const guestToken = await readGuestToken(link.eventId);
    const guest = guestToken ? await db.guestSession.findUnique({ where: { tokenHash: sha256(guestToken) } }) : null;
    if (!guest || guest.eventId !== link.eventId) return NextResponse.json({ error: "no_session" }, { status: 403 });
    return channelStream(guestChannel(guest.id), req.signal);
  } catch (e) {
    return apiError(e);
  }
}
