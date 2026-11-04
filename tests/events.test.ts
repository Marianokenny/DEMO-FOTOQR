import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createEvent, deleteEvent, getEventForUser, getEventStats, listEventsForUser, updateEvent } from "@/lib/events";
import { can, ForbiddenError } from "@/lib/permissions";
import { makeUser, sampleEvent } from "./helpers";

describe("creación de eventos", () => {
  it("crea el evento con su dueño, configuración por defecto y tres enlaces exclusivos", async () => {
    const owner = await makeUser();
    const event = await createEvent(owner, sampleEvent);
    const full = await db.event.findUniqueOrThrow({
      where: { id: event.id },
      include: { members: true, links: true, projectionSettings: true, uploadSettings: true },
    });
    expect(full.members).toEqual([expect.objectContaining({ userId: owner.id, role: "owner" })]);
    expect(full.links.map((l) => l.type).sort()).toEqual(["gallery", "screen", "upload"]);
    expect(new Set(full.links.map((l) => l.token)).size).toBe(3);
    full.links.forEach((l) => expect(l.token.length).toBeGreaterThanOrEqual(22));
    expect(full.projectionSettings).toMatchObject({ enabled: false, autoApprove: false, photoSeconds: 8 });
    expect(full.uploadSettings).toMatchObject({ allowVideos: true, maxFilesPerGuest: 50 });
    expect(full.storageUntil.getTime() - full.date.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("arranca con todas las estadísticas en cero", async () => {
    const owner = await makeUser();
    const event = await createEvent(owner, sampleEvent);
    expect(await getEventStats(event.id)).toEqual({
      received: 0, photos: 0, videos: 0, approved: 0, pending: 0, rejected: 0,
    });
  });
});

describe("permisos por evento", () => {
  it("un organizador solo ve sus propios eventos", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const eventA = await createEvent(a, { ...sampleEvent, name: "Evento de A" });
    await createEvent(b, { ...sampleEvent, name: "Evento de B" });
    const listA = await listEventsForUser(a);
    expect(listA.map((e) => e.name)).toEqual(["Evento de A"]);
    await expect(getEventForUser(b, eventA.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("otro organizador no puede editar ni borrar un evento ajeno", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const event = await createEvent(owner, sampleEvent);
    await expect(updateEvent(intruder, event.id, { ...sampleEvent, name: "Hackeado" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteEvent(intruder, event.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).name).toBe(sampleEvent.name);
  });

  it("un moderador puede ver y moderar, pero no configurar ni borrar", async () => {
    const owner = await makeUser();
    const mod = await makeUser();
    const event = await createEvent(owner, sampleEvent);
    await db.eventMember.create({ data: { eventId: event.id, userId: mod.id, role: "moderator" } });
    expect(await can(mod, event.id, "view")).toBe(true);
    expect(await can(mod, event.id, "moderate")).toBe(true);
    expect(await can(mod, event.id, "configure")).toBe(false);
    expect(await can(mod, event.id, "delete")).toBe(false);
  });

  it("el administrador general ve y administra todos los eventos", async () => {
    const owner = await makeUser();
    const admin = await makeUser("admin");
    const event = await createEvent(owner, sampleEvent);
    expect((await listEventsForUser(admin)).some((e) => e.id === event.id)).toBe(true);
    expect(await can(admin, event.id, "configure")).toBe(true);
  });

  it("el dueño puede editar y borrar su evento", async () => {
    const owner = await makeUser();
    const event = await createEvent(owner, sampleEvent);
    await updateEvent(owner, event.id, { ...sampleEvent, name: "Los 15 de Sofía", storageDays: 60 });
    const updated = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.name).toBe("Los 15 de Sofía");
    expect(updated.storageUntil.getTime() - updated.date.getTime()).toBe(60 * 24 * 60 * 60 * 1000);
    await deleteEvent(owner, event.id);
    expect(await db.event.findUnique({ where: { id: event.id } })).toBeNull();
    expect(await db.accessLink.count({ where: { eventId: event.id } })).toBe(0);
  });
});
