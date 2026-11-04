/**
 * Shrinks big photos in the phone before uploading: a 12 MB photo becomes ~1.5 MB,
 * which matters on venue Wi-Fi and mobile data. The server re-processes everything anyway.
 */
const MAX_SIDE = 3000;
const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressPhoto(file: File): Promise<File> {
  if (!COMPRESSIBLE.has(file.type) || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // unsupported in this browser: upload the original
  }
}
