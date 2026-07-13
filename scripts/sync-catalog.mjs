/**
 * Upsert the canonical project + land catalog without wiping leads.
 * Usage: node scripts/sync-catalog.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
function get(key) {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}
if (get("DATABASE_URL")) process.env.DATABASE_URL = get("DATABASE_URL");
if (get("DIRECT_URL")) process.env.DIRECT_URL = get("DIRECT_URL");

const LAND_TYPES = [
  "Development",
  "Farmland",
  "Timberland",
  "Ranching",
  "Homestead",
  "Hunting",
];

const DEFAULT_PRICES = [75, 135, 220];

const PROJECT_CATALOG = [
  { name: "Culvert Install", icon: "drainage", prices: [60, 110, 180] },
  { name: "Barndominium Building", icon: "grading", prices: [150, 250, 400] },
  { name: "Brush Hogging", icon: "brush-mowing", prices: [40, 75, 120] },
  { name: "Pond Building", icon: "pond", prices: [120, 200, 300] },
  { name: "Cabin Construction", icon: "grading", prices: [150, 250, 400] },
  { name: "Driveway Construction", icon: "road", prices: [70, 130, 210] },
  { name: "Water Well Drilling", icon: "well-drilling", prices: [120, 200, 300] },
  { name: "Gated Entrance", icon: "fencing", prices: [50, 90, 150] },
  { name: "Drainage Improvement", icon: "drainage", prices: [60, 110, 180] },
  { name: "Irrigation System Installation", icon: "drainage", prices: [80, 140, 220] },
  { name: "Retaining Wall Construction", icon: "grading", prices: [90, 160, 250] },
  { name: "Utility Trenching", icon: "excavation", prices: [50, 90, 150] },
  { name: "Tree Removal & Stump Grinding", icon: "tree-service", prices: [60, 110, 180] },
  { name: "Land Grading & Leveling", icon: "grading", prices: [70, 130, 210] },
];

const prisma = new PrismaClient();
const dollars = (d) => d * 100;

async function main() {
  console.log("Syncing catalog…");

  for (const name of LAND_TYPES) {
    await prisma.landType.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const entry of PROJECT_CATALOG) {
    const typeName = entry.name;
    const prices = entry.prices ?? DEFAULT_PRICES;
    const ct = await prisma.contractorType.upsert({
      where: { name: typeName },
      update: { icon: entry.icon },
      create: { name: typeName, icon: entry.icon },
    });

    await prisma.service.upsert({
      where: { name_contractorTypeId: { name: typeName, contractorTypeId: ct.id } },
      update: {},
      create: { name: typeName, contractorTypeId: ct.id },
    });

    const pt = await prisma.projectType.upsert({
      where: { name_contractorTypeId: { name: typeName, contractorTypeId: ct.id } },
      update: {},
      create: { name: typeName, contractorTypeId: ct.id },
    });

    for (let i = 0; i < 3; i++) {
      const tier = i + 1;
      await prisma.priceTier.upsert({
        where: {
          contractorTypeId_projectTypeId_tier: {
            contractorTypeId: ct.id,
            projectTypeId: pt.id,
            tier,
          },
        },
        update: { priceCents: dollars(prices[i]) },
        create: {
          contractorTypeId: ct.id,
          projectTypeId: pt.id,
          tier,
          priceCents: dollars(prices[i]),
        },
      });
    }
  }

  console.log(
    `Done. Upserted ${PROJECT_CATALOG.length} project types and ${LAND_TYPES.length} land types.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
