import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "@/lib/domain/types";
import { getActiveEstimateTaxonomies } from "./estimate-taxonomies";

describe("active estimate taxonomies", () => {
  it("uses archivedAt null and isActiveForNewIntake for live selectors", async () => {
    const projectFindMany = vi.fn().mockResolvedValue([
      { code: "culvert-install", name: "CULVERT INSTALL" },
    ]);
    const landFindMany = vi.fn().mockResolvedValue([
      { code: "residential", name: "Residential" },
    ]);
    const categoryFindMany = vi.fn().mockResolvedValue([
      { code: "roofing", name: "Roofing" },
    ]);
    const workTypeFindMany = vi.fn().mockResolvedValue([
      { code: "repair", name: "Repair" },
    ]);
    const db = {
      projectType: { findMany: projectFindMany },
      landType: { findMany: landFindMany },
      contractorCategory: { findMany: categoryFindMany },
      workType: { findMany: workTypeFindMany },
    } as unknown as DbClient;

    const result = await getActiveEstimateTaxonomies(db);

    expect(result.projectTypes[0]?.code).toBe("culvert-install");
    expect(result.workTypes[0]?.code).toBe("repair");
    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { archivedAt: null } }),
    );
    for (const findMany of [landFindMany, categoryFindMany, workTypeFindMany]) {
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { archivedAt: null, isActiveForNewIntake: true },
        }),
      );
    }
  });
});
