import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getScreenState } from "@/lib/projection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    return NextResponse.json(await getScreenState((await params).token), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
