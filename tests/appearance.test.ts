import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { appearanceSchema, readAppearance } from "@/lib/appearance";
import { addAsset, AssetError, deleteAsset, saveAppearance } from "@/lib/assets";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/events";
import { getActiveLink } from "@/lib/links";
import { ForbiddenError } from "@/lib/permissions";
import { getScreenState } from "@/lib/projection";
import { redis } from "@/lib/redis";
import { localStorageDriver } from "@/lib/storage";
import { makeUser, sampleEvent } from "./helpers";

afterAll(() => redis().disconnect());

const png = () => sharp({ create: { width: 800, height: 450, channels: 4, background: { r: 255, g: 91, b: 46, alpha: 0.5 } } }).png().toBuffer();

async function seed() {
  const owner = await makeUser();
  const event = await createEvent(owner, sampleEvent);
  const screen = (await getActiveLink(event.id, "screen"))!;
  return { owner, event, token: screen.token };
}

describe("apariencia", () => {
  it("por defecto el texto de espera es «Subí tu foto o video»", () => {
    const a = readAppearance({});
    expect(a.waitingText).toMatchObject({ enabled: true, text: "Subí tu foto o video", showQr: true });
    expect(readAppearance({ waitingText: { size: 9999 } }).waitingText.size).toBe(96); // invalid → safe defaults
  });

  it("guarda la apariencia y la pantalla la recibe", async () => {
    const { owner, event, token } = await seed();
    const a = appearanceSchema.parse({ background: { color: "#112233", brightness: 0.6 }, waitingText: { text: "¡Feliz cumple Sofi!", font: "Great Vibes", size: 120, color: "#FFFFFF" } });
    await saveAppearance(owner, event.id, a);
    const state = await getScreenState(token);
    expect(state.appearance.background).toMatchObject({ color: "#112233", brightness: 0.6 });
    expect(state.appearance.waitingText).toMatchObject({ text: "¡Feliz cumple Sofi!", font: "Great Vibes", size: 120 });
  });

  it("sube imágenes como capas, conserva la transparencia y las entrega firmadas", async () => {
    const { owner, event, token } = await seed();
    const asset = await addAsset(owner, event.id, "layer", await png());
    expect(asset.key).toBe(`events/${event.id}/assets/${asset.id}.webp`);
    const meta = await sharp(localStorageDriver().pathFor(asset.key)).metadata();
    expect(meta.hasAlpha).toBe(true);
    await saveAppearance(owner, event.id, appearanceSchema.parse({ layers: [{ id: "l1", assetId: asset.id, opacity: 0.4 }] }));
    const state = await getScreenState(token);
    expect(state.appearance.layers[0]).toMatchObject({ assetId: asset.id, opacity: 0.4 });
    expect(state.assets[asset.id]).toMatch(/sig=/);
  });

  it("rechaza archivos que no son imágenes", async () => {
    const { owner, event } = await seed();
    await expect(addAsset(owner, event.id, "background", Buffer.from("no soy una imagen"))).rejects.toBeInstanceOf(AssetError);
  });

  it("no permite usar imágenes de otro evento", async () => {
    const a = await seed();
    const b = await seed();
    const foreign = await addAsset(b.owner, b.event.id, "background", await png());
    const saved = await saveAppearance(a.owner, a.event.id, appearanceSchema.parse({ background: { assetId: foreign.id }, layers: [{ id: "x", assetId: foreign.id }] }));
    expect(saved.background.assetId).toBeNull();
    expect(saved.layers).toEqual([]);
  });

  it("al borrar una imagen se quita del fondo y de las capas", async () => {
    const { owner, event } = await seed();
    const asset = await addAsset(owner, event.id, "background", await png());
    await saveAppearance(owner, event.id, appearanceSchema.parse({ background: { assetId: asset.id }, layers: [{ id: "l", assetId: asset.id }] }));
    await deleteAsset(owner, event.id, asset.id);
    const s = await db.projectionSettings.findUniqueOrThrow({ where: { eventId: event.id } });
    expect(readAppearance(s.appearance)).toMatchObject({ background: { assetId: null }, layers: [] });
    expect(await localStorageDriver().size(asset.key)).toBeNull();
  });

  it("solo el dueño puede cambiar la apariencia", async () => {
    const { event } = await seed();
    const other = await makeUser();
    await expect(saveAppearance(other, event.id, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});
