import { describe, expect, it } from "vitest";
import { parseLocalDateTime, toLocalInputValue } from "@/lib/dates";
import { eventInputSchema } from "@/lib/validation";

describe("fechas en hora argentina", () => {
  it("interpreta la hora del formulario como hora de Argentina", () => {
    expect(parseLocalDateTime("2026-12-12T21:00").toISOString()).toBe("2026-12-13T00:00:00.000Z");
  });
  it("ida y vuelta sin perder la hora", () => {
    expect(toLocalInputValue(parseLocalDateTime("2026-12-12T21:30"))).toBe("2026-12-12T21:30");
  });
  it("valida los datos del evento", () => {
    const ok = eventInputSchema.safeParse({ name: "Boda", type: "wedding", date: "2026-12-12T21:00", brandColor: "#8B5CF6", storageDays: "30" });
    expect(ok.success).toBe(true);
    const bad = eventInputSchema.safeParse({ name: "", type: "nope", date: "", brandColor: "rojo" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(Object.keys(bad.error.flatten().fieldErrors).sort()).toEqual(["brandColor", "date", "name", "type"]);
  });
});
