import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { AssetError, saveAppearance } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    return NextResponse.json({ appearance: await saveAppearance(user, id, await readJson(req, 64 * 1024)) });
  } catch (e) {
    if (e instanceof AssetError) return NextResponse.json({ error: "invalid", message: e.message }, { status: 400 });
    return apiError(e);
  }
}
