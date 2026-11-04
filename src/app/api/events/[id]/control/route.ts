import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { controlScreen, getLive, LiveError } from "@/lib/live";
import { assertCan } from "@/lib/permissions";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["playNow", "pin"]), mediaId: z.string().max(40) }),
  z.object({ kind: z.enum(["unpin", "skip", "pause", "resume", "qr", "leaderboard", "winner", "selfie"]) }),
]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    await assertCan(user, id, "view");
    return NextResponse.json(await getLive(id));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = schema.safeParse(await readJson(req, 4096));
    if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    return NextResponse.json(await controlScreen(user, id, parsed.data));
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ error: "invalid", message: e.message }, { status: 400 });
    return apiError(e);
  }
}
