import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { readGuestToken } from "@/lib/guest-cookie";
import { completeUpload, getGuestEvent } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ token: string; mediaId: string }> }) {
  try {
    const { token, mediaId } = await params;
    const { event } = await getGuestEvent(token);
    return NextResponse.json(await completeUpload({ token, mediaId, guestToken: await readGuestToken(event.id) }));
  } catch (e) {
    return apiError(e);
  }
}
