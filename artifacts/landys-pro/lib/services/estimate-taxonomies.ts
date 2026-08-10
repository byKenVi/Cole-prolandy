import type { DbClient } from "@/lib/domain/types";

export async function getActiveEstimateTaxonomies(db: DbClient) {
  const [projectTypes, landTypes, contractorCategories] = await Promise.all([
    db.projectType.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.landType.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.contractorCategory.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  return { projectTypes, landTypes, contractorCategories };
}
