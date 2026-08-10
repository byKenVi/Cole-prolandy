import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createFakeDb } from "./__fixtures__/fakeDb";
import { PriceNotFoundError } from "./errors";
import { resolvePrice } from "./pricing";

describe("project tier pricing", () => {
  it("returns the exact integer-cent value from the existing pricing matrix", async () => {
    const db = createFakeDb();
    db.priceTier.seed([
      {
        id: "price-1",
        contractorTypeId: "trade-1",
        projectTypeId: "project-1",
        tier: 3,
        priceCents: 12_345,
      },
    ]);

    await expect(
      resolvePrice(db as unknown as PrismaClient, {
        contractorTypeId: "trade-1",
        projectTypeId: "project-1",
        tier: 3,
      }),
    ).resolves.toBe(12_345);
  });

  it("fails closed when the configured tier price does not exist", async () => {
    const db = createFakeDb();

    await expect(
      resolvePrice(db as unknown as PrismaClient, {
        contractorTypeId: "trade-1",
        projectTypeId: "project-1",
        tier: 1,
      }),
    ).rejects.toBeInstanceOf(PriceNotFoundError);
  });
});
