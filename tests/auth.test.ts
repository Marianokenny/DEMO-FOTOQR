import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate, EmailTakenError, registerUser } from "@/lib/users";
import { createSession, deleteSession, getUserBySessionToken } from "@/lib/sessions";
import { sha256 } from "@/lib/tokens";
import { makeUser } from "./helpers";

describe("registro y login", () => {
  it("guarda la contraseña con hash, nunca en texto plano", async () => {
    const user = await registerUser({ name: "Ana", email: "ana@test.local", password: "clave-de-ana" });
    expect(user.passwordHash).not.toContain("clave-de-ana");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
  });

  it("no permite dos cuentas con el mismo email", async () => {
    await registerUser({ name: "Beto", email: "beto@test.local", password: "clave-de-beto" });
    await expect(
      registerUser({ name: "Beto 2", email: "beto@test.local", password: "otra-clave" }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("autentica con la contraseña correcta y rechaza la incorrecta o un email inexistente", async () => {
    await registerUser({ name: "Caro", email: "caro@test.local", password: "clave-de-caro" });
    expect((await authenticate("caro@test.local", "clave-de-caro"))?.email).toBe("caro@test.local");
    expect(await authenticate("caro@test.local", "incorrecta")).toBeNull();
    expect(await authenticate("nadie@test.local", "clave-de-caro")).toBeNull();
  });
});

describe("sesiones", () => {
  it("crea una sesión, la resuelve y la cierra", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    expect((await getUserBySessionToken(token))?.id).toBe(user.id);
    await deleteSession(token);
    expect(await getUserBySessionToken(token)).toBeNull();
  });

  it("solo guarda el hash del token en la base", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    expect(await db.session.findUnique({ where: { id: token } })).toBeNull();
    expect(await db.session.findUnique({ where: { id: sha256(token) } })).not.toBeNull();
  });

  it("rechaza sesiones vencidas y tokens inventados", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    await db.session.update({ where: { id: sha256(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getUserBySessionToken(token)).toBeNull();
    expect(await getUserBySessionToken("token-inventado")).toBeNull();
    expect(await getUserBySessionToken(undefined)).toBeNull();
  });
});
