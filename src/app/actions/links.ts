"use server";

import type { LinkType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseLocalDateTime } from "@/lib/dates";
import { updateUploadSettings } from "@/lib/events";
import { regenerateLink, setLinkExpiry } from "@/lib/links";
import { uploadSettingsSchema } from "@/lib/validation";
import type { FormState } from "./auth";

export async function regenerateLinkAction(eventId: string, type: LinkType) {
  const user = await requireUser();
  await regenerateLink(user, eventId, type);
  revalidatePath(`/panel/eventos/${eventId}`);
}

export async function setLinkExpiryAction(eventId: string, type: LinkType, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = String(formData.get("expiresAt") ?? "");
  const date = raw ? parseLocalDateTime(raw) : null;
  if (date && Number.isNaN(date.getTime())) return { fieldErrors: { expiresAt: ["Fecha inválida."] } };
  await setLinkExpiry(user, eventId, type, date);
  revalidatePath(`/panel/eventos/${eventId}`);
  return { error: undefined, values: { saved: "1" } };
}

export async function updateUploadSettingsAction(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = uploadSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  await updateUploadSettings(user, eventId, parsed.data);
  revalidatePath(`/panel/eventos/${eventId}`);
  return { values: { saved: "1" } };
}
