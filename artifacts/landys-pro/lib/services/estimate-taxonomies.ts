import type { DbClient } from "@/lib/domain/types";

export async function getActiveEstimateTaxonomies(db: DbClient) {
  const [projectTypes, landTypes, contractorCategories, workTypes] = await Promise.all([
    db.projectType.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.landType.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.contractorCategory.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.workType.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  return { projectTypes, landTypes, contractorCategories, workTypes };
}

export async function getLiveIntakeTaxonomies(db: DbClient) {
  const [landTypes, contractorCategories, workTypes] = await Promise.all([
    db.landType.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.contractorCategory.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    db.workType.findMany({
      where: { archivedAt: null, isActiveForNewIntake: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);
  return { landTypes, contractorCategories, workTypes };
}
