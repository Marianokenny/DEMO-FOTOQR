import { db } from "@/lib/db";
import { registerUser } from "@/lib/users";

let n = 0;
export async function makeUser(role: "admin" | "organizer" = "organizer") {
  n += 1;
  const user = await registerUser({
    name: `Usuario ${n}`,
    email: `user${n}-${Date.now()}@test.local`,
    password: "contraseña-segura",
  });
  if (role === "admin") return db.user.update({ where: { id: user.id }, data: { role: "admin" } });
  return user;
}

export const sampleEvent = {
  name: "Los 15 de Sofi",
  type: "quince" as const,
  date: new Date("2026-12-12T21:00:00Z"),
  venue: "Salón Las Rosas",
  brandColor: "#8B5CF6",
  storageDays: 30,
};
