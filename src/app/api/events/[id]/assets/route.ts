import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { addAsset, AssetError } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    const usage = form.get("usage") === "background" ? "background" : "layer";
    if (!(file instanceof File)) return NextResponse.json({ error: "invalid", message: "Elegí una imagen." }, { status: 400 });
    const asset = await addAsset(user, id, usage, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ id: asset.id, url: await storage().presignDownload(asset.key, 12 * 3600), width: asset.width, height: asset.height });
  } catch (e) {
    if (e instanceof AssetError) return NextResponse.json({ error: "invalid", message: e.message }, { status: 400 });
    return apiError(e);
  }
}
