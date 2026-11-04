import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJson } from "@/lib/api";
import { reportNowPlaying } from "@/lib/live";

export const runtime = "nodejs";

const schema = z.object({ nowId: z.string().max(40).nullable(), nextId: z.string().max(40).nullable() });

/** The screen reports what it is showing; used by the live control and the guest heads-up. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const parsed = schema.safeParse(await readJson(req, 1024));
    if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
    await reportNowPlaying((await params).token, parsed.data.nowId, parsed.data.nextId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
