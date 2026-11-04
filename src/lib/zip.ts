import archiver from "archiver";
import { Readable } from "node:stream";
import { storage } from "./storage";

/** Streams a ZIP built on the fly: nothing is written to disk and memory stays flat for any size. */
export function zipResponse(fileName: string, entries: { key: string; name: string }[]) {
  const archive = archiver("zip", { store: true }); // photos and videos are already compressed
  (async () => {
    try {
      for (const e of entries) {
        const stream = await storage().openRead(e.key).catch(() => null);
        if (!stream) continue; // a file removed meanwhile should not break the whole download
        archive.append(stream, { name: e.name });
        // Wait for this entry to be consumed before opening the next one.
        await new Promise<void>((resolve) => { stream.once("end", resolve); stream.once("error", () => resolve()); });
      }
      await archive.finalize();
    } catch (err) {
      archive.abort();
      console.error("[zip]", err);
    }
  })();
  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function zipFileName(eventName: string, type?: string) {
  const slug = eventName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evento";
  return `${slug}${type === "photo" ? "-fotos" : type === "video" ? "-videos" : ""}.zip`;
}

export function parseType(v: string | null) {
  return v === "photo" || v === "video" ? v : undefined;
}
