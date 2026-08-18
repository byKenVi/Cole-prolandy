import type { PrismaClient } from "@prisma/client";
import type {
  ContractorSyncStore,
  ContractorSyncWrite,
  ResolvedContractorTaxonomies,
  StoredContractorSyncView,
} from "./store";

export class PrismaContractorSyncStore implements ContractorSyncStore {
  constructor(private readonly db: PrismaClient) {}

  async findByExternalIdentity(
    source: string,
    externalId: string,
  ): Promise<StoredContractorSyncView | null> {
    const identity = await this.db.externalContractorIdentity.findUnique({
      where: { source_externalId: { source, externalId } },
      include: {
        contractor: {
          include: {
            contractorCategory: { select: { code: true } },
            projects: {
              include: {
                contractorType: {
                  include: { projectType: { select: { code: true } } },
                },
              },
            },
            workTypes: {
              include: { workType: { select: { code: true } } },
            },
          },
        },
      },
    });
    if (!identity) return null;

    return {
      contractorId: identity.contractor.id,
      deactivated: Boolean(identity.contractor.deactivatedAt),
      name: identity.contractor.name,
      email: identity.contractor.email,
      phone: identity.contractor.phone,
      aboutSection: identity.contractor.aboutSection,
      businessHours: identity.contractor.businessHours,
      contractorCategoryCode: identity.contractor.contractorCategory?.code ?? null,
      projectTypeCodes: identity.contractor.projects
        .flatMap((assignment) =>
          assignment.contractorType.projectType?.code
            ? [assignment.contractorType.projectType.code]
            : [],
        )
        .sort(),
      workTypeCodes: identity.contractor.workTypes
        .map((entry) => entry.workType.code)
        .sort(),
      lastPayloadHash: identity.lastPayloadHash,
    };
  }

  async resolveTaxonomies(
    contractorCategoryCode: string | undefined,
    projectTypeCodes: readonly string[] | undefined,
    workTypeCodes: readonly string[] | undefined,
  ): Promise<ResolvedContractorTaxonomies> {
    const requestedProjects = [...new Set(projectTypeCodes ?? [])];
    const requestedWorkTypes = [...new Set(workTypeCodes ?? [])];
    const [category, projects, workTypes] = await Promise.all([
      contractorCategoryCode
        ? this.db.contractorCategory.findFirst({
            where: {
              code: contractorCategoryCode,
              archivedAt: null,
              isActiveForNewIntake: true,
            },
            select: { id: true, code: true },
          })
        : null,
      requestedProjects.length > 0
        ? this.db.projectType.findMany({
            where: { code: { in: requestedProjects }, archivedAt: null },
            select: { code: true, contractorTypeId: true },
          })
        : [],
      requestedWorkTypes.length > 0
        ? this.db.workType.findMany({
            where: {
              code: { in: requestedWorkTypes },
              archivedAt: null,
              isActiveForNewIntake: true,
            },
            select: { id: true, code: true },
          })
        : [],
    ]);

    const resolvedProjectCodes = new Set(projects.map((project) => project.code));
    const resolvedWorkTypeCodes = new Set(workTypes.map((workType) => workType.code));
    const unresolvedCodes = [
      ...(contractorCategoryCode && !category ? [contractorCategoryCode] : []),
      ...requestedProjects.filter((code) => !resolvedProjectCodes.has(code)),
      ...requestedWorkTypes.filter((code) => !resolvedWorkTypeCodes.has(code)),
    ];

    return {
      contractorCategoryId: category?.id,
      contractorCategoryCode: category?.code,
      projects: projects.map((project) => ({
        projectTypeCode: project.code,
        contractorTypeId: project.contractorTypeId,
      })),
      workTypes: workTypes.map((workType) => ({
        workTypeCode: workType.code,
        workTypeId: workType.id,
      })),
      unresolvedCodes,
    };
  }

  async createContractor(
    write: ContractorSyncWrite,
  ): Promise<{ contractorId: string }> {
    return this.db.$transaction(async (tx) => {
      const primaryProject = write.projects[0];
      const contractor = await tx.contractor.create({
        data: {
          name: write.profile.name,
          email: write.profile.email,
          phone: write.profile.phone,
          aboutSection: write.profile.aboutSection,
          businessHours: write.profile.businessHours,
          contractorTypeId: primaryProject?.contractorTypeId ?? null,
          contractorCategoryId: write.contractorCategoryId,
          ...(write.projects.length > 0
            ? {
                projects: {
                  create: write.projects.map((project) => ({
                    contractorTypeId: project.contractorTypeId,
                  })),
                },
              }
            : {}),
          ...(write.workTypes.length > 0
            ? {
                workTypes: {
                  create: write.workTypes.map((workType) => ({
                    workTypeId: workType.workTypeId,
                  })),
                },
              }
            : {}),
        },
        select: { id: true },
      });
      await tx.externalContractorIdentity.create({
        data: {
          source: write.source,
          externalId: write.externalId,
          contractorId: contractor.id,
          lastPayloadHash: write.payloadHash,
          lastSyncedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "system",
          actorId: `contractor-sync:${write.source}`,
          action: "contractor.sync.created",
          targetType: "Contractor",
          targetId: contractor.id,
          metadata: {
            source: write.source,
            externalId: write.externalId,
            changes: write.changes,
          },
        },
      });
      return { contractorId: contractor.id };
    });
  }

  async updateContractor(
    contractorId: string,
    write: ContractorSyncWrite,
  ): Promise<{ contractorId: string }> {
    return this.db.$transaction(async (tx) => {
      await tx.contractor.update({
        where: { id: contractorId },
        data: {
          name: write.profile.name,
          email: write.profile.email,
          phone: write.profile.phone,
          aboutSection: write.profile.aboutSection,
          businessHours: write.profile.businessHours,
          contractorCategoryId: write.contractorCategoryId,
          ...(write.changes.includes("projects")
            ? { contractorTypeId: write.projects[0]?.contractorTypeId ?? null }
            : {}),
        },
      });

      if (write.changes.includes("projects")) {
        await tx.contractorProject.deleteMany({ where: { contractorId } });
        if (write.projects.length > 0) {
          await tx.contractorProject.createMany({
            data: write.projects.map((project) => ({
              contractorId,
              contractorTypeId: project.contractorTypeId,
            })),
          });
        }
      }

      if (write.changes.includes("workTypes")) {
        await tx.contractorWorkType.deleteMany({ where: { contractorId } });
        if (write.workTypes.length > 0) {
          await tx.contractorWorkType.createMany({
            data: write.workTypes.map((workType) => ({
              contractorId,
              workTypeId: workType.workTypeId,
            })),
          });
        }
      }

      await tx.externalContractorIdentity.update({
        where: {
          source_externalId: {
            source: write.source,
            externalId: write.externalId,
          },
        },
        data: {
          lastPayloadHash: write.payloadHash,
          lastSyncedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: "system",
          actorId: `contractor-sync:${write.source}`,
          action: "contractor.sync.updated",
          targetType: "Contractor",
          targetId: contractorId,
          metadata: {
            source: write.source,
            externalId: write.externalId,
            changes: write.changes,
          },
        },
      });
      return { contractorId };
    });
  }
}
