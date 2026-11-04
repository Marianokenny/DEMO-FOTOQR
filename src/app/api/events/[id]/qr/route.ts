import type { LinkType } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getActiveLink, linkUrl } from "@/lib/links";
import { assertCan } from "@/lib/permissions";
import { qrPng, qrSvg } from "@/lib/qr";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    await assertCan(user, id, "view");
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") ?? "upload") as LinkType;
    if (!["upload", "gallery"].includes(type)) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const link = await getActiveLink(id, type);
    if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const target = linkUrl(type, link.token);
    const download = url.searchParams.get("download") === "1";
    const name = `qr-${type === "upload" ? "invitados" : "galeria"}`;
    if (url.searchParams.get("format") === "svg") {
      return new Response(await qrSvg(target), {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", ...(download ? { "Content-Disposition": `attachment; filename="${name}.svg"` } : {}) },
      });
    }
    return new Response(new Uint8Array(await qrPng(target)), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store", ...(download ? { "Content-Disposition": `attachment; filename="${name}.png"` } : {}) },
    });
  } catch (e) {
    return apiError(e);
  }
}
