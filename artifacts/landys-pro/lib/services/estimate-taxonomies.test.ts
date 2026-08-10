import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "@/lib/domain/types";
import { getActiveEstimateTaxonomies } from "./estimate-taxonomies";

describe("active estimate taxonomies", () => {
  it("uses archivedAt null for every public selector", async () => {
    const projectFindMany = vi.fn().mockResolvedValue([
      { code: "culvert-install", name: "CULVERT INSTALL" },
    ]);
    const landFindMany = vi.fn().mockResolvedValue([
      { code: "development", name: "Development" },
    ]);
    const categoryFindMany = vi.fn().mockResolvedValue([
      { code: "builders", name: "Builders" },
    ]);
    const db = {
      projectType: { findMany: projectFindMany },
      landType: { findMany: landFindMany },
      contractorCategory: { findMany: categoryFindMany },
    } as unknown as DbClient;

    const result = await getActiveEstimateTaxonomies(db);

    expect(result.projectTypes[0]?.code).toBe("culvert-install");
    for (const findMany of [projectFindMany, landFindMany, categoryFindMany]) {
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { archivedAt: null } }),
      );
    }
  });
});
