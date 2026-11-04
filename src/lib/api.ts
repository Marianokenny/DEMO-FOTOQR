import { NextResponse } from "next/server";
import { LinkError } from "./links";
import { ForbiddenError } from "./permissions";
import { UploadError } from "./uploads";

/** Maps known errors to JSON responses with a Spanish message the UI can show as is. */
export function apiError(e: unknown) {
  if (e instanceof UploadError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
  if (e instanceof LinkError) return NextResponse.json({ error: e.reason, message: e.message }, { status: e.reason === "not_found" ? 404 : 410 });
  if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden", message: e.message }, { status: 403 });
  console.error(e);
  return NextResponse.json({ error: "internal", message: "Algo salió mal. Probá de nuevo." }, { status: 500 });
}
