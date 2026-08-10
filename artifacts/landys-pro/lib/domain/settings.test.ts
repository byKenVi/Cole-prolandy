import { describe, expect, it } from "vitest";
import { createFakeDb } from "./__fixtures__/fakeDb";
import {
  getDefaultLeadTier,
  getLeadExpiryHours,
  getMaxLeadRecipients,
} from "./settings";
import type { DbClient } from "./types";

describe("application settings", () => {
  it("reads the migration defaults used by fresh databases", async () => {
    const db = createFakeDb();

    await expect(getMaxLeadRecipients(db as unknown as DbClient)).resolves.toBe(3);
    await expect(getLeadExpiryHours(db as unknown as DbClient)).resolves.toBe(48);
  });

  it("keeps defaultLeadTier available as clamped legacy compatibility", async () => {
    const db = createFakeDb();
    await db.appSetting.update({
      where: { key: "defaultLeadTier" },
      data: { value: "9" },
    });

    await expect(getDefaultLeadTier(db as unknown as DbClient)).resolves.toBe(3);
  });

  it("fails closed when a required setting is absent", async () => {
    const db = createFakeDb();
    db.appSetting.rows = db.appSetting.rows.filter(
      (row) => row.key !== "maxLeadRecipients",
    );

    await expect(getMaxLeadRecipients(db as unknown as DbClient)).rejects.toThrow(
      "Missing required AppSetting: maxLeadRecipients",
    );
  });
});
