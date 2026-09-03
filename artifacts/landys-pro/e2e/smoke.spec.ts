import { test, expect } from "@playwright/test";
import { assertBrowserTargetSafe } from "../lib/ops/database-safety";

test.beforeAll(() => {
  assertBrowserTargetSafe(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");
});

/**
 * Lightweight smoke — requires `pnpm dev` + seeded local DB (AUTH_MODE=dev).
 * Does not mutate production; hostname guard fails closed.
 */
test.describe("local smoke", () => {
  test("landing page loads", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok() || res?.status() === 200 || res?.status() === 307).toBeTruthy();
  });

  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("body")).toBeVisible();
  });
});
