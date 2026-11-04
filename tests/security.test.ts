import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/storage/object/route";
import { readJson } from "@/lib/api";
import { consume } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";
import { storage } from "@/lib/storage";

afterAll(() => redis().disconnect());

describe("seguridad y robustez", () => {
  it("rechaza cuerpos JSON demasiado grandes o inválidos", async () => {
    const big = JSON.stringify({ ids: Array.from({ length: 50_000 }, (_, i) => `id-${i}`) });
    expect(await readJson(new Request("http://x", { method: "POST", body: big }), 64 * 1024)).toBeNull();
    expect(await readJson(new Request("http://x", { method: "POST", body: "{nope" }))).toBeNull();
    expect(await readJson(new Request("http://x", { method: "POST", body: '{"a":1}' }))).toEqual({ a: 1 });
  });

  it("limita los intentos de login por cuenta", async () => {
    const key = `login:email:test-${Date.now()}@x`;
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await consume(key, 1, 10, 60));
    expect(results.filter(Boolean)).toHaveLength(10);
  });

  it("los archivos responden por rangos (videos en iPhone) y no se interpretan como página", async () => {
    const key = `events/test/range-${Date.now()}.mp4`;
    await storage().put(key, Buffer.from("0123456789"), "video/mp4");
    const url = await storage().presignDownload(key, 60);
    const full = await GET(new Request(url));
    expect(full.status).toBe(200);
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(full.headers.get("x-content-type-options")).toBe("nosniff");
    const part = await GET(new Request(url, { headers: { range: "bytes=2-5" } }));
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await part.text()).toBe("2345");
    const tail = await GET(new Request(url, { headers: { range: "bytes=-3" } }));
    expect(await tail.text()).toBe("789");
    expect((await GET(new Request(url, { headers: { range: "bytes=20-" } }))).status).toBe(416);
    const tampered = url.replace("range-", "otro-");
    expect((await GET(new Request(tampered))).status).toBeGreaterThanOrEqual(400);
  });
});
