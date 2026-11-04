import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://fotosqr:fotosqr@localhost:5432/fotosqr_test?schema=public";

/** Applies pending migrations to the test database and empties every table. */
export default async function setup() {
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
  if (!url.includes("_test")) throw new Error("Refusing to truncate a non-test database: " + url);
  const prisma = new PrismaClient({ datasourceUrl: url });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
  }
  await prisma.$disconnect();
  const redis = new IORedis("redis://localhost:6379/1");
  await redis.flushdb();
  await redis.quit();
  rmSync("/tmp/fotosqr-test-storage", { recursive: true, force: true });
}
