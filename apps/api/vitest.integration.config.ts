import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.int.test.ts"],
    // Tests share one database; run files serially.
    fileParallelism: false,
  },
});
