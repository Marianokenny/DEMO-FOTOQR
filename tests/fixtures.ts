import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = "/tmp/fotosqr-fixtures";

/** A 3000x2000 JPEG with GPS data in its EXIF, rotated by EXIF orientation 6 (phone held upright). */
export async function photoWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 80, b: 40 } } })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "31/1 25/1 0/1" } } })
    .toBuffer();
}

export function video(seconds: number, name = `clip-${seconds}s.mov`): string {
  mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, name);
  if (!existsSync(file)) {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `testsrc=size=1280x720:rate=30:duration=${seconds}`,
      "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`, "-c:v", "libx264", "-c:a", "aac", "-shortest", file]);
  }
  return file;
}
