import { defineConfig, devices } from "@playwright/test";

// Run against an already-running server when PW_BASE_URL is set (local dev);
// otherwise Playwright boots the production server itself (used in CI).
const baseURL = process.env.PW_BASE_URL || "http://localhost:3000";
const executablePath = process.env.PW_EXECUTABLE_PATH; // pin a browser locally if needed

export default defineConfig({
  testDir: "./e2e",
  // The tests share one seeded database, so they must not run in parallel.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(process.env.PW_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run start:prod",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
