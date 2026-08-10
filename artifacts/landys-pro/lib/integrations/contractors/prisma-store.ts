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
      lastPayloadHash: identity.lastPayloadHash,
    };
  }

  async resolveTaxonomies(
    contractorCategoryCode: string | undefined,
    projectTypeCodes: readonly string[] | undefined,
  ): Promise<ResolvedContractorTaxonomies> {
    const requestedProjects = [...new Set(projectTypeCodes ?? [])];
    const [category, projects] = await Promise.all([
      contractorCategoryCode
        ? this.db.contractorCategory.findFirst({
            where: { code: contractorCategoryCode, archivedAt: null },
            select: { id: true, code: true },
          })
        : null,
      requestedProjects.length > 0
        ? this.db.projectType.findMany({
            where: { code: { in: requestedProjects }, archivedAt: null },
            select: { code: true, contractorTypeId: true },
          })
        : [],
    ]);

    const resolvedProjectCodes = new Set(projects.map((project) => project.code));
    const unresolvedCodes = [
      ...(contractorCategoryCode && !category ? [contractorCategoryCode] : []),
      ...requestedProjects.filter((code) => !resolvedProjectCodes.has(code)),
    ];

    return {
      contractorCategoryId: category?.id,
      contractorCategoryCode: category?.code,
      projects: projects.map((project) => ({
        projectTypeCode: project.code,
        contractorTypeId: project.contractorTypeId,
      })),
      unresolvedCodes,
    };
  }

  async createContractor(
    write: ContractorSyncWrite,
  ): Promise<{ contractorId: string }> {
    return this.db.$transaction(async (tx) => {
      const primaryProject = write.projects[0]!;
      const contractor = await tx.contractor.create({
        data: {
          name: write.profile.name,
          email: write.profile.email,
          phone: write.profile.phone,
          aboutSection: write.profile.aboutSection,
          businessHours: write.profile.businessHours,
          contractorTypeId: primaryProject.contractorTypeId,
          contractorCategoryId: write.contractorCategoryId,
          projects: {
            create: write.projects.map((project) => ({
              contractorTypeId: project.contractorTypeId,
            })),
          },
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
            ? { contractorTypeId: write.projects[0]!.contractorTypeId }
            : {}),
        },
      });

      if (write.changes.includes("projects")) {
        await tx.contractorProject.deleteMany({ where: { contractorId } });
        await tx.contractorProject.createMany({
          data: write.projects.map((project) => ({
            contractorId,
            contractorTypeId: project.contractorTypeId,
          })),
        });
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
