import { defineConfig } from "vitest/config";

// `npm test` runs pure unit tests only (no database, no Redis). Tests that need
// a real, migrated database live in tests/integration and run via
// `npm run test:integration` -- never against a database you care about.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**"],
  },
});
