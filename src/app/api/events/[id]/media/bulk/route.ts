import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { approveAllPending, moderate } from "@/lib/moderation";

export const runtime = "nodejs";

const schema = z.union([
  z.object({ action: z.enum(["approve", "reject", "delete"]), ids: z.array(z.string().max(40)).min(1).max(500) }),
  z.object({ action: z.literal("approveAllPending") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const body = parsed.data;
    return NextResponse.json(body.action === "approveAllPending" ? await approveAllPending(user, id) : await moderate(user, id, body.ids, body.action));
  } catch (e) {
    return apiError(e);
  }
}
