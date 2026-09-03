import { defineConfig, devices } from "@playwright/test";
import { assertBrowserTargetSafe } from "./lib/ops/database-safety";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
assertBrowserTargetSafe(baseURL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
