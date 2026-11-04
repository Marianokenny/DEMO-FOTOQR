import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { zipEntries } from "@/lib/gallery";
import { LinkError, resolveLink } from "@/lib/links";
import { consume } from "@/lib/rate-limit";
import { clientInfo } from "@/lib/guest-cookie";
import { parseType, zipFileName, zipResponse } from "@/lib/zip";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const link = await resolveLink(token, "gallery");
    const { ip } = await clientInfo();
    if (!(await consume(`zip:${ip}`, 1, 10, 3600))) {
      return NextResponse.json({ error: "rate_limited", message: "Demasiadas descargas seguidas. Probá en un rato." }, { status: 429 });
    }
    const type = parseType(new URL(req.url).searchParams.get("type"));
    const { event, entries } = await zipEntries(link.eventId, type);
    return zipResponse(zipFileName(event.name, type), entries);
  } catch (e) {
    if (e instanceof LinkError) return NextResponse.json({ error: e.reason, message: e.message }, { status: 404 });
    return apiError(e);
  }
}
