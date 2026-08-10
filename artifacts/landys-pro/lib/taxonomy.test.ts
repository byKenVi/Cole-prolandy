import { describe, expect, it, vi } from "vitest";
import { availableIntegrationCode, integrationCodeFromName } from "./taxonomy";

describe("taxonomy integration codes", () => {
  it("derives stable lowercase codes from display names", () => {
    expect(integrationCodeFromName("Tree Removal & Stump Grinding")).toBe(
      "tree-removal-and-stump-grinding",
    );
  });

  it("allocates a deterministic suffix without changing existing codes", async () => {
    const exists = vi.fn(async (candidate: string) =>
      ["land-clearing", "land-clearing-2"].includes(candidate),
    );

    await expect(availableIntegrationCode("Land Clearing", exists)).resolves.toBe(
      "land-clearing-3",
    );
  });

  it("rejects names that cannot produce an integration code", () => {
    expect(() => integrationCodeFromName("---")).toThrow(
      "Could not derive a stable integration code",
    );
  });
});
