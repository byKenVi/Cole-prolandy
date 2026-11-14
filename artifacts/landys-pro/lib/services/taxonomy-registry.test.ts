import { describe, expect, it } from "vitest";
import { createFakeDb } from "@/lib/domain/__fixtures__/fakeDb";
import { ensureCategory, humanizeTaxonomy, slugifyTaxonomy } from "./taxonomy-registry";

describe("taxonomy registry", () => {
  it("turns labels into stable codes and readable names", () => {
    expect(slugifyTaxonomy("Dirt Work & Excavation")).toBe("dirt-work-excavation");
    expect(humanizeTaxonomy("land-lenders")).toBe("Land Lenders");
    expect(humanizeTaxonomy("Kitchen & Bath")).toBe("Kitchen & Bath");
  });

  it("creates an unknown category once and reuses it", async () => {
    const db = createFakeDb();
    const first = await ensureCategory(db, "Land Lenders");
    const again = await ensureCategory(db, "land-lenders");
    expect(first).toMatchObject({ code: "land-lenders", name: "Land Lenders", created: true });
    expect(again).toMatchObject({ id: first!.id, created: false });
  });

  it("routes a merged category to its target", async () => {
    const db = createFakeDb();
    db.contractorCategory.seed([{ id: "cat-roofing", code: "roofing", name: "Roofing", archivedAt: null }]);
    db.appSetting.seed([{ key: "categoryAliases", value: JSON.stringify({ "roofing-gutters": "roofing" }) }]);
    const ref = await ensureCategory(db, "Roofing & Gutters");
    expect(ref).toMatchObject({ id: "cat-roofing", code: "roofing", created: false });
    expect(db.contractorCategory.rows).toHaveLength(1);
  });
});
