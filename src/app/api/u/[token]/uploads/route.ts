import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api";
import { clientInfo, readGuestToken, writeGuestToken } from "@/lib/guest-cookie";
import { createUploads, getGuestEvent, uploadRequestSchema } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const parsed = uploadRequestSchema.safeParse(await readJson(req, 256 * 1024));
    if (!parsed.success) return NextResponse.json({ error: "invalid", message: "Solicitud inválida." }, { status: 400 });
    const { event } = await getGuestEvent(token);
    const result = await createUploads({
      token, guestToken: await readGuestToken(event.id), request: parsed.data, ...(await clientInfo()),
    });
    await writeGuestToken(event.id, result.guestToken);
    return NextResponse.json({ uploads: result.uploads });
  } catch (e) {
    return apiError(e);
  }
}
