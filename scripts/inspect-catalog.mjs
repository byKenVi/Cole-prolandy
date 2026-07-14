import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const cts = await p.contractorType.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { contractors: true, projectTypes: true, services: true } },
      projectTypes: { select: { id: true, name: true, _count: { select: { leads: true } } } },
    },
  });
  console.log("=== CONTRACTOR TYPES ===");
  for (const c of cts) {
    console.log(
      JSON.stringify({
        name: c.name,
        icon: c.icon,
        contractors: c._count.contractors,
        projectTypes: c._count.projectTypes,
        pts: c.projectTypes.map((x) => `${x.name}(leads:${x._count.leads})`),
      }),
    );
  }

  const contractors = await p.contractor.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      contractorType: { select: { name: true } },
    },
  });
  console.log("=== CONTRACTORS ===");
  for (const c of contractors) {
    console.log(JSON.stringify({ name: c.name, email: c.email, type: c.contractorType.name }));
  }

  const leads = await p.lead.findMany({
    select: {
      id: true,
      projectType: {
        select: { name: true, contractorType: { select: { name: true } } },
      },
      tier: true,
      priceCents: true,
      status: true,
    },
  });
  console.log("=== LEADS", leads.length, "===");
  for (const l of leads) {
    console.log(
      JSON.stringify({
        id: l.id.slice(0, 8),
        pt: l.projectType.name,
        ct: l.projectType.contractorType.name,
        tier: l.tier,
        price: l.priceCents,
        status: l.status,
      }),
    );
  }

  const ptCount = await p.projectType.count();
  const priceCount = await p.priceTier.count();
  console.log("=== totals CT", cts.length, "PT", ptCount, "prices", priceCount);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
