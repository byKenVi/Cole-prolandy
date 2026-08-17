import { describe, expect, it } from "vitest";
import { createFakeDb } from "./__fixtures__/fakeDb";
import { getMaxLeadPurchases, getLeadExpiryHours } from "./settings";

describe("settings", () => {
  it("reads maxLeadPurchases", async () => {
    const db = createFakeDb();
    await expect(getMaxLeadPurchases(db)).resolves.toBe(3);
    await expect(getLeadExpiryHours(db)).resolves.toBe(48);
  });
});
