import { describe, expect, it } from "vitest";
import { Playlist } from "@/components/screen/playlist";
import type { ScreenItem } from "@/lib/projection";

const item = (id: string, minute: number): ScreenItem => ({
  id, type: "photo", url: id, posterUrl: null, senderName: null, message: null, durationMs: null, width: 1, height: 1,
  approvedAt: new Date(Date.UTC(2026, 10, 4, 22, minute)).toISOString(),
});

describe("orden de reproducción", () => {
  it("lo nuevo primero y después en bucle", () => {
    const p = new Playlist("newest_first");
    p.sync([item("a", 1), item("b", 2), item("c", 3)]);
    expect([p.next(), p.next(), p.next(), p.next()].map((i) => i?.id)).toEqual(["c", "b", "a", "c"]);
  });

  it("por orden de llegada", () => {
    const p = new Playlist("chronological");
    p.sync([item("b", 2), item("a", 1)]);
    expect([p.next(), p.next(), p.next()].map((i) => i?.id)).toEqual(["a", "b", "a"]);
  });

  it("lo recién aprobado se cuela adelante, en el orden en que llegó", () => {
    const p = new Playlist("chronological");
    p.sync([item("a", 1), item("b", 2), item("c", 3)]);
    expect(p.next()?.id).toBe("a");
    p.sync([item("a", 1), item("b", 2), item("c", 3), item("x", 10), item("y", 11)]);
    expect([p.next(), p.next(), p.next()].map((i) => i?.id)).toEqual(["x", "y", "b"]);
  });

  it("lo que se saca de la pantalla no vuelve a salir", () => {
    const p = new Playlist("chronological");
    p.sync([item("a", 1), item("b", 2)]);
    p.remove("b");
    expect([p.next(), p.next()].map((i) => i?.id)).toEqual(["a", "a"]);
  });

  it("aleatorio pasa por todos antes de repetir", () => {
    const p = new Playlist("random");
    p.sync(["a", "b", "c", "d"].map((id, i) => item(id, i)));
    expect(new Set([p.next(), p.next(), p.next(), p.next()].map((i) => i?.id)).size).toBe(4);
  });

  it("sin contenido devuelve nada", () => {
    expect(new Playlist("random").next()).toBeNull();
  });
});
