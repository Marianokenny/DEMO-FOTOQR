import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://fotosqr:fotosqr@localhost:5432/fotosqr_test?schema=public",
    },
    fileParallelism: false,
    testTimeout: 20000,
  },
});
