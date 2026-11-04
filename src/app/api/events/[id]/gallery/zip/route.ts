import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { zipEntries } from "@/lib/gallery";
import { assertCan } from "@/lib/permissions";
import { parseType, zipFileName, zipResponse } from "@/lib/zip";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    await assertCan(user, id, "view");
    const type = parseType(new URL(req.url).searchParams.get("type"));
    const { event, entries } = await zipEntries(id, type);
    return zipResponse(zipFileName(event.name, type), entries);
  } catch (e) {
    return apiError(e);
  }
}
