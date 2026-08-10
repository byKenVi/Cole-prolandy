import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [projects, landTypes, settings, leadStatusCounts] = await Promise.all([
    prisma.contractorType.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        projectType: {
          select: {
            id: true,
            name: true,
            _count: { select: { leads: true } },
            priceTiers: {
              orderBy: { tier: "asc" },
              select: { id: true, tier: true, priceCents: true },
            },
          },
        },
        _count: {
          select: {
            contractors: true,
            assignedContractors: true,
          },
        },
      },
    }),
    prisma.landType.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        _count: { select: { leads: true } },
      },
    }),
    prisma.appSetting.findMany({
      where: {
        key: {
          in: ["maxLeadRecipients", "leadExpiryHours", "defaultLeadTier"],
        },
      },
      orderBy: { key: "asc" },
      select: { key: true, value: true, updatedAt: true },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    safety: {
      readOnly: true,
      containsLandownerPii: false,
      containsContractorPii: false,
      containsFinancialAccountData: false,
    },
    appSettings: settings,
    contractorTypeProjectBridge: projects.map((project) => ({
      contractorTypeId: project.id,
      contractorTypeName: project.name,
      createdAt: project.createdAt,
      primaryContractorCount: project._count.contractors,
      assignedContractorCount: project._count.assignedContractors,
      projectType: project.projectType
        ? {
            id: project.projectType.id,
            name: project.projectType.name,
            leadReferenceCount: project.projectType._count.leads,
            priceTiers: project.projectType.priceTiers,
          }
        : null,
    })),
    landTypes: landTypes.map((landType) => ({
      id: landType.id,
      name: landType.name,
      leadReferenceCount: landType._count.leads,
    })),
    leadStatusCounts: leadStatusCounts.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error("Taxonomy preflight export failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
