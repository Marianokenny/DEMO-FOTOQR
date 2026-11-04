import { db } from "./db";
import { hashPassword, verifyPassword } from "./passwords";

export class EmailTakenError extends Error {
  constructor() {
    super("Ya existe una cuenta con ese email.");
  }
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new EmailTakenError();
  return db.user.create({
    data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
  });
}

/** Returns the user when the credentials match, otherwise null. Same answer for unknown email and bad password. */
export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    // Spend similar time as a real check so response time does not reveal which emails exist.
    await verifyPassword(password, "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.6fZ9w5Lx2EoDMl6o5b4yI1a2b3c.");
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}
