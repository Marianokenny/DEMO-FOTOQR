import type { MemberRole, User } from "@prisma/client";
import { db } from "./db";

export type EventAction =
  | "view"        // see the event, its stats and its content
  | "moderate"    // approve, reject, delete content
  | "configure"   // edit event, projection, appearance, links
  | "delete"      // delete the whole event
  | "manageMembers";

const ROLE_ACTIONS: Record<MemberRole, EventAction[]> = {
  owner: ["view", "moderate", "configure", "delete", "manageMembers"],
  moderator: ["view", "moderate"],
};

export class ForbiddenError extends Error {
  constructor() {
    super("No tenés permiso para esta acción.");
  }
}

/** Returns the role a user has on an event, or null. Platform admins act as owners everywhere. */
export async function getEventRole(
  user: Pick<User, "id" | "role">,
  eventId: string,
): Promise<MemberRole | null> {
  if (user.role === "admin") {
    const exists = await db.event.count({ where: { id: eventId } });
    return exists ? "owner" : null;
  }
  const member = await db.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
  });
  return member?.role ?? null;
}

export function roleAllows(role: MemberRole | null, action: EventAction): boolean {
  return role ? ROLE_ACTIONS[role].includes(action) : false;
}

export async function can(user: Pick<User, "id" | "role">, eventId: string, action: EventAction) {
  return roleAllows(await getEventRole(user, eventId), action);
}

export async function assertCan(user: Pick<User, "id" | "role">, eventId: string, action: EventAction) {
  if (!(await can(user, eventId, action))) throw new ForbiddenError();
}
