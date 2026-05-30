import { defineConfig, devices } from "@playwright/test";

// Boots both apps (realtime on 8080, web dev on 3000) and points the web app at
// the local realtime server. A full game auto-advances through reveal (4s) and
// leaderboard (5s) per question, so the test timeout is generous.
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @yalla/realtime start",
      port: 8080,
      reuseExistingServer: !process.env.CI,
      env: { ALLOWED_ORIGINS: "http://localhost:3000" },
    },
    {
      command: "pnpm --filter @yalla/web dev",
      port: 3000,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: { NEXT_PUBLIC_REALTIME_URL: "ws://localhost:8080" },
    },
  ],
});
