"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createEvent, deleteEvent, updateEvent } from "@/lib/events";
import { eventInputSchema } from "@/lib/validation";
import type { FormState } from "./auth";

const KEYS = ["name", "type", "date", "venue", "brandColor", "storageDays"];

function valuesOf(formData: FormData) {
  return Object.fromEntries(KEYS.map((k) => [k, String(formData.get(k) ?? "")]));
}

export async function createEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = eventInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: valuesOf(formData) };
  const event = await createEvent(user, parsed.data);
  revalidatePath("/panel");
  redirect(`/panel/eventos/${event.id}`);
}

export async function updateEventAction(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = eventInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: valuesOf(formData) };
  await updateEvent(user, eventId, parsed.data);
  revalidatePath(`/panel/eventos/${eventId}`);
  revalidatePath("/panel");
  redirect(`/panel/eventos/${eventId}?guardado=1`);
}

export async function deleteEventAction(eventId: string) {
  const user = await requireUser();
  await deleteEvent(user, eventId);
  revalidatePath("/panel");
  redirect("/panel");
}
