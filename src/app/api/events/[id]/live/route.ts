import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { eventStream } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live channel for the organizer panel: new uploads, status changes, removals. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    await assertCan(user, id, "view");
    return eventStream(id, req.signal);
  } catch (e) {
    return apiError(e);
  }
}
