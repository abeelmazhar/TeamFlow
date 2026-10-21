import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { NODE_ENV: "test" },
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts"],
    fileParallelism: false, // all files share ONE test database, so run them one at a time
  },
});