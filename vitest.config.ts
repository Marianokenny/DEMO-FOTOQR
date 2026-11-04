import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      APP_URL: "http://localhost:3000",
      APP_SECRET: "test-secret-0123456789",
      REDIS_URL: "redis://localhost:6379/1",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: "/tmp/fotosqr-test-storage",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://fotosqr:fotosqr@localhost:5432/fotosqr_test?schema=public",
    },
    fileParallelism: false,
    testTimeout: 60000,
  },
});
