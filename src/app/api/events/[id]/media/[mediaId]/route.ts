import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { moderate } from "@/lib/moderation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; mediaId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id, mediaId } = await params;
    const parsed = z.object({ action: z.enum(["approve", "reject"]) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    return NextResponse.json(await moderate(user, id, [mediaId], parsed.data.action));
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id, mediaId } = await params;
    return NextResponse.json(await moderate(user, id, [mediaId], "delete"));
  } catch (e) {
    return apiError(e);
  }
}
