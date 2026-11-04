export type PresignedUpload = { url: string; method: "PUT"; headers: Record<string, string> };

export interface StorageDriver {
  /** URL the browser PUTs the file to directly, valid for `expiresIn` seconds. */
  presignUpload(key: string, contentType: string, maxBytes: number, expiresIn?: number): Promise<PresignedUpload>;
  /** Temporary URL to read a private object. */
  presignDownload(key: string, expiresIn?: number, downloadName?: string): Promise<string>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Copies an object to a local file path. */
  download(key: string, filePath: string): Promise<void>;
  /** Size in bytes, or null when the object does not exist. */
  size(key: string): Promise<number | null>;
  /** Streams an object (ZIP downloads). */
  openRead(key: string): Promise<import("node:stream").Readable>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}
