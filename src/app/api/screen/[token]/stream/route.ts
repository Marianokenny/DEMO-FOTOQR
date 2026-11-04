import { apiError } from "@/lib/api";
import { resolveLink } from "@/lib/links";
import { eventStream } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live channel for the projection screen. The screen only reacts to approvals, removals and settings. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const link = await resolveLink((await params).token, "screen");
    return eventStream(link.eventId, req.signal);
  } catch (e) {
    return apiError(e);
  }
}
