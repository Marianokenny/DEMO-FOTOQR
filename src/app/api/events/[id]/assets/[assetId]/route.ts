import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { deleteAsset } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id, assetId } = await params;
    await deleteAsset(user, id, assetId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
