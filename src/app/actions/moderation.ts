"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setAutoApprove } from "@/lib/moderation";

export async function setAutoApproveAction(eventId: string, enabled: boolean) {
  const user = await requireUser();
  await setAutoApprove(user, eventId, enabled);
  revalidatePath(`/panel/eventos/${eventId}`);
}
