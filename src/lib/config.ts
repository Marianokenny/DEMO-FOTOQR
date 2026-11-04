function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const config = {
  get appUrl() { return required("APP_URL", "http://localhost:3000").replace(/\/$/, ""); },
  get appSecret() { return required("APP_SECRET"); },
  get redisUrl() { return required("REDIS_URL", "redis://localhost:6379"); },
  get storageDriver() { return (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3"; },
  get storageLocalDir() { return process.env.STORAGE_LOCAL_DIR ?? "./.storage"; },
};
