import type { MediaType } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { listMedia, type StatusFilter } from "@/lib/moderation";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    const sp = new URL(req.url).searchParams;
    const status = (["pending", "approved", "rejected", "all"].includes(sp.get("status") ?? "") ? sp.get("status") : "pending") as StatusFilter;
    const type = (["photo", "video"].includes(sp.get("type") ?? "") ? sp.get("type") : "all") as MediaType | "all";
    return NextResponse.json(await listMedia(user, id, { status, type, cursor: sp.get("cursor") ?? undefined }));
  } catch (e) {
    return apiError(e);
  }
}
