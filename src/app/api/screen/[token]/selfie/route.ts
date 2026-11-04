import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { selfieIfDue, selfieMosaic } from "@/lib/live";

export const runtime = "nodejs";

/** Photos that arrived during the selfie moment. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    return NextResponse.json({ items: await selfieMosaic((await params).token) });
  } catch (e) {
    return apiError(e);
  }
}

/** The screen asks every minute whether the scheduled selfie is due. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    return NextResponse.json({ started: await selfieIfDue((await params).token) });
  } catch (e) {
    return apiError(e);
  }
}
