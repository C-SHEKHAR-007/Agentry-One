import { defineConfig, devices } from "@playwright/test";

/**
 * Browser e2e tests. They drive the built web app, whose /api proxy points at
 * E2E_API_URL -- run the API against a disposable database, since the auth
 * setup step completes first-run setup if it hasn't been done:
 *
 *   E2E_API_URL=http://127.0.0.1:4100 E2E_EMAIL=... E2E_PASSWORD=... npx playwright test
 */
const PORT = Number(process.env.E2E_WEB_PORT ?? 5174);
const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // A production build served by `vite preview` (same /api proxy): tests the
    // real bundle, and needs no file watchers.
    command: `cd ../web && npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { VITE_API_PROXY_TARGET: API_URL },
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
