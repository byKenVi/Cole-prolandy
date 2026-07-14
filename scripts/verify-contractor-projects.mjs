import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const rows = await p.contractor.findMany({
    include: {
      contractorType: true,
      projects: { include: { contractorType: true } },
    },
    orderBy: { name: "asc" },
  });
  for (const c of rows) {
    console.log(
      JSON.stringify({
        name: c.name,
        email: c.email,
        primary: c.contractorType.name,
        projects: c.projects.map((x) => x.contractorType.name),
      }),
    );
  }
  console.log("contractors", rows.length);
  console.log("unassigned", rows.filter((c) => c.projects.length === 0).length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
