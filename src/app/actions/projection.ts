"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseLocalDateTime } from "@/lib/dates";
import { projectionSettingsSchema, updateProjectionSettings } from "@/lib/projection";
import type { FormState } from "./auth";

export async function toggleProjectionAction(eventId: string, enabled: boolean) {
  const user = await requireUser();
  await updateProjectionSettings(user, eventId, { enabled });
  revalidatePath(`/panel/eventos/${eventId}`);
}

export async function saveProjectionSettingsAction(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const f = Object.fromEntries(formData);
  const raw = String(f.expiresAt ?? "");
  const parsed = projectionSettingsSchema.omit({ enabled: true }).safeParse({
    expiresAt: raw ? parseLocalDateTime(raw) : null,
    photoSeconds: Number(f.photoSeconds),
    videoMode: f.videoMode,
    videoMaxSeconds: Number(f.videoMaxSeconds),
    videoMuted: f.videoMuted !== "on",
    transition: f.transition,
    playOrder: f.playOrder,
    showSenderName: f.showSenderName === "on",
  });
  if (!parsed.success) return { error: "Revisá los valores: hay alguno fuera de rango." };
  await updateProjectionSettings(user, eventId, parsed.data);
  revalidatePath(`/panel/eventos/${eventId}`);
  return { values: { saved: String(Date.now()) } };
}

export async function setShowSenderNameAction(eventId: string, showSenderName: boolean) {
  const user = await requireUser();
  await updateProjectionSettings(user, eventId, { showSenderName });
  revalidatePath(`/panel/eventos/${eventId}`);
}
