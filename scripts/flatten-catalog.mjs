/**
 * Flatten catalog to Project → Tier (exactly 3) and remap legacy nested data.
 *
 * Usage: node --import tsx scripts/flatten-catalog.mjs
 * Writes remap report to scripts/flatten-catalog-report.json
 */
import { readFileSync, writeFileSync } from "fs";
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

/** Anchors: small culvert ≈ $40, large pond ≈ $200. */
const PROJECT_CATALOG = [
  { name: "Culvert Install", icon: "drainage", prices: [40, 75, 110] },
  { name: "Barndominium Building", icon: "grading", prices: [100, 160, 220] },
  { name: "Brush Hogging", icon: "brush-mowing", prices: [40, 70, 110] },
  { name: "Pond Building", icon: "pond", prices: [90, 140, 200] },
  { name: "Cabin Construction", icon: "grading", prices: [100, 160, 220] },
  { name: "Driveway Construction", icon: "road", prices: [50, 95, 150] },
  { name: "Water Well Drilling", icon: "well-drilling", prices: [80, 130, 200] },
  { name: "Gated Entrance", icon: "fencing", prices: [45, 80, 130] },
  { name: "Drainage Improvement", icon: "drainage", prices: [45, 85, 140] },
  { name: "Irrigation System Installation", icon: "drainage", prices: [55, 100, 160] },
  { name: "Retaining Wall Construction", icon: "grading", prices: [70, 120, 185] },
  { name: "Utility Trenching", icon: "excavation", prices: [45, 85, 140] },
  { name: "Tree Removal & Stump Grinding", icon: "tree-service", prices: [50, 95, 150] },
  { name: "Land Grading & Leveling", icon: "grading", prices: [50, 95, 150] },
];

/** Map legacy contractor-type names → canonical project name. */
const CONTRACTOR_TYPE_MAP = {
  "Excavation / Dirt Work": "Utility Trenching",
  "Land Clearing": "Tree Removal & Stump Grinding",
  "Pond Building": "Pond Building",
  Fencing: "Gated Entrance",
  "Drainage / Culvert": "Drainage Improvement",
  "Road / Driveway": "Driveway Construction",
  "Well Drilling": "Water Well Drilling",
  "Brush Mowing": "Brush Hogging",
  Grading: "Land Grading & Leveling",
  Septic: "Utility Trenching",
  Surveying: "Land Grading & Leveling",
  "Tree Service": "Tree Removal & Stump Grinding",
};

/** Per-contractor overrides when a type alone is too coarse. */
const CONTRACTOR_EMAIL_MAP = {
  "ridgeline@example.com": "Land Grading & Leveling",
  "bigsky@example.com": "Utility Trenching",
  "lihounhintoe@gmail.com": "Utility Trenching",
};

/**
 * Map legacy nested project-type names → canonical project.
 * Exact match first, then keyword heuristics.
 */
const PROJECT_TYPE_EXACT = {
  "Culvert Install": "Culvert Install",
  "Culvert Installation": "Culvert Install",
  "Barndominium Building": "Barndominium Building",
  "Brush Hogging": "Brush Hogging",
  "Pond Building": "Pond Building",
  "Pond Excavation": "Pond Building",
  "Pond Dredging / Cleanout": "Pond Building",
  "Dam / Levee Construction": "Pond Building",
  "Cabin Construction": "Cabin Construction",
  "Driveway Construction": "Driveway Construction",
  "Gravel Driveway Install": "Driveway Construction",
  "Driveway Grading / Repair": "Driveway Construction",
  "Culvert & Road Base": "Culvert Install",
  "Water Well Drilling": "Water Well Drilling",
  "Well Pump Install / Repair": "Water Well Drilling",
  "Well Site Evaluation": "Water Well Drilling",
  "Gated Entrance": "Gated Entrance",
  "Gate Installation": "Gated Entrance",
  "Farm / Field Fence": "Gated Entrance",
  "Privacy Fence": "Gated Entrance",
  "Drainage Improvement": "Drainage Improvement",
  "French Drain": "Drainage Improvement",
  "Drainage Grading": "Drainage Improvement",
  "Irrigation System Installation": "Irrigation System Installation",
  "Retaining Wall Construction": "Retaining Wall Construction",
  "Utility Trenching": "Utility Trenching",
  Trenching: "Utility Trenching",
  "Tree Removal & Stump Grinding": "Tree Removal & Stump Grinding",
  "Tree Removal": "Tree Removal & Stump Grinding",
  "Stump Grinding": "Tree Removal & Stump Grinding",
  "Lot Tree Trimming": "Tree Removal & Stump Grinding",
  "Brush & Undergrowth Clearing": "Brush Hogging",
  "Tree & Stump Removal": "Tree Removal & Stump Grinding",
  "Lot Clearing": "Tree Removal & Stump Grinding",
  "Field / Pasture Mowing": "Brush Hogging",
  "Right-of-Way Mowing": "Brush Hogging",
  "Forestry Mulching": "Brush Hogging",
  "Land Grading & Leveling": "Land Grading & Leveling",
  "Site Grading": "Land Grading & Leveling",
  "Pad / Building Prep": "Land Grading & Leveling",
  "Finish Grading": "Land Grading & Leveling",
  "Site Excavation": "Utility Trenching",
  "Foundation Dig": "Land Grading & Leveling",
  "Boundary Survey": "Land Grading & Leveling",
  "Topographic Survey": "Land Grading & Leveling",
  "Plat / Subdivision Survey": "Land Grading & Leveling",
  "Septic System Install": "Utility Trenching",
  "Septic Repair": "Utility Trenching",
  "Perc Test / Site Eval": "Land Grading & Leveling",
};

function resolveProjectName(legacyName, fallbackCategory) {
  if (PROJECT_TYPE_EXACT[legacyName]) return PROJECT_TYPE_EXACT[legacyName];
  if (CONTRACTOR_TYPE_MAP[legacyName]) return CONTRACTOR_TYPE_MAP[legacyName];
  if (fallbackCategory && CONTRACTOR_TYPE_MAP[fallbackCategory]) {
    return CONTRACTOR_TYPE_MAP[fallbackCategory];
  }
  // Catalog self-match
  const hit = PROJECT_CATALOG.find((p) => p.name === legacyName);
  if (hit) return hit.name;
  return "Land Grading & Leveling";
}

const prisma = new PrismaClient();
const dollars = (d) => d * 100;

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    projectsSeeded: [],
    contractors: [],
    leads: [],
    deletedContractorTypes: [],
    deletedProjectTypes: [],
    notes: [],
  };

  console.log("Flattening catalog to Project → 3 tiers…");

  /** @type {Record<string, { ctId: string, ptId: string }>} */
  const byName = {};

  for (const entry of PROJECT_CATALOG) {
    const ct = await prisma.contractorType.upsert({
      where: { name: entry.name },
      update: { icon: entry.icon },
      create: { name: entry.name, icon: entry.icon },
    });

    // Prefer an existing same-named child, else create.
    let pt = await prisma.projectType.findFirst({
      where: { contractorTypeId: ct.id, name: entry.name },
    });
    if (!pt) {
      pt = await prisma.projectType.create({
        data: { name: entry.name, contractorTypeId: ct.id },
      });
    }

    // Ensure a matching service row (optional UX / profile).
    await prisma.service.upsert({
      where: { name_contractorTypeId: { name: entry.name, contractorTypeId: ct.id } },
      update: {},
      create: { name: entry.name, contractorTypeId: ct.id },
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
        update: { priceCents: dollars(entry.prices[i]) },
        create: {
          contractorTypeId: ct.id,
          projectTypeId: pt.id,
          tier,
          priceCents: dollars(entry.prices[i]),
        },
      });
    }

    byName[entry.name] = { ctId: ct.id, ptId: pt.id };
    report.projectsSeeded.push({
      name: entry.name,
      icon: entry.icon,
      pricesUsd: entry.prices,
      contractorTypeId: ct.id,
      projectTypeId: pt.id,
    });
  }

  // ── Remap contractors ──
  const contractors = await prisma.contractor.findMany({
    include: { contractorType: { select: { id: true, name: true } } },
  });
  for (const c of contractors) {
    const targetName =
      CONTRACTOR_EMAIL_MAP[c.email.toLowerCase()] ??
      CONTRACTOR_TYPE_MAP[c.contractorType.name] ??
      (PROJECT_CATALOG.some((p) => p.name === c.contractorType.name)
        ? c.contractorType.name
        : "Land Grading & Leveling");
    const target = byName[targetName];
    if (!target) throw new Error(`Missing target project ${targetName}`);
    const from = c.contractorType.name;
    if (c.contractorTypeId !== target.ctId) {
      await prisma.contractor.update({
        where: { id: c.id },
        data: { contractorTypeId: target.ctId },
      });
    }
    report.contractors.push({
      id: c.id,
      name: c.name,
      email: c.email,
      fromType: from,
      toProject: targetName,
    });
  }

  // ── Remap leads (keep snapshotted priceCents) ──
  const leads = await prisma.lead.findMany({
    include: {
      projectType: { include: { contractorType: { select: { name: true } } } },
    },
  });
  for (const lead of leads) {
    const targetName = resolveProjectName(
      lead.projectType.name,
      lead.projectType.contractorType.name,
    );
    const target = byName[targetName];
    const fromPt = lead.projectType.name;
    const fromCt = lead.projectType.contractorType.name;
    if (lead.projectTypeId !== target.ptId) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { projectTypeId: target.ptId },
        // priceCents intentionally untouched
      });
    }
    report.leads.push({
      id: lead.id,
      fromProjectType: fromPt,
      fromCategory: fromCt,
      toProject: targetName,
      tier: lead.tier,
      priceCentsKept: lead.priceCents,
      status: lead.status,
    });
  }

  // ── Collapse each canonical CT to a single same-named PT ──
  for (const entry of PROJECT_CATALOG) {
    const { ctId, ptId } = byName[entry.name];
    const extras = await prisma.projectType.findMany({
      where: { contractorTypeId: ctId, NOT: { id: ptId } },
      include: { _count: { select: { leads: true } } },
    });
    for (const extra of extras) {
      if (extra._count.leads > 0) {
        // Should already be remapped; force-move any stragglers
        await prisma.lead.updateMany({
          where: { projectTypeId: extra.id },
          data: { projectTypeId: ptId },
        });
      }
      await prisma.priceTier.deleteMany({ where: { projectTypeId: extra.id } });
      await prisma.projectType.delete({ where: { id: extra.id } });
      report.deletedProjectTypes.push({
        id: extra.id,
        name: extra.name,
        under: entry.name,
      });
    }
  }

  // ── Delete non-canonical ContractorTypes (after remaps) ──
  const allTypes = await prisma.contractorType.findMany({
    include: {
      _count: { select: { contractors: true, projectTypes: true } },
      projectTypes: { select: { id: true, name: true, _count: { select: { leads: true } } } },
    },
  });
  const canonical = new Set(PROJECT_CATALOG.map((p) => p.name));
  for (const ct of allTypes) {
    if (canonical.has(ct.name)) continue;
    if (ct._count.contractors > 0) {
      report.notes.push(
        `SKIP delete "${ct.name}" — still has ${ct._count.contractors} contractor(s)`,
      );
      continue;
    }
    const leadCount = ct.projectTypes.reduce((s, p) => s + p._count.leads, 0);
    if (leadCount > 0) {
      // Remap any remaining leads via resolveProjectName
      for (const pt of ct.projectTypes) {
        if (pt._count.leads === 0) continue;
        const targetName = resolveProjectName(pt.name, ct.name);
        const target = byName[targetName];
        await prisma.lead.updateMany({
          where: { projectTypeId: pt.id },
          data: { projectTypeId: target.ptId },
        });
        report.notes.push(
          `Remapped remaining leads from ${ct.name}/${pt.name} → ${targetName}`,
        );
      }
    }
    // Cascade: delete price tiers + project types + services, then type
    await prisma.priceTier.deleteMany({ where: { contractorTypeId: ct.id } });
    await prisma.projectType.deleteMany({ where: { contractorTypeId: ct.id } });
    await prisma.service.deleteMany({ where: { contractorTypeId: ct.id } });
    await prisma.contractorType.delete({ where: { id: ct.id } });
    report.deletedContractorTypes.push({ id: ct.id, name: ct.name });
  }

  // Verify
  const remaining = await prisma.contractorType.findMany({
    include: {
      _count: { select: { contractors: true, projectTypes: true } },
      projectTypes: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  report.finalProjects = remaining.map((c) => ({
    name: c.name,
    contractors: c._count.contractors,
    projectTypes: c.projectTypes.map((p) => p.name),
  }));

  const out = resolve(process.cwd(), "scripts/flatten-catalog-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Done. Report → ${out}`);
  console.log(
    `Projects: ${remaining.length}, contractors remapped: ${report.contractors.length}, leads remapped: ${report.leads.length}, deleted categories: ${report.deletedContractorTypes.length}`,
  );
  for (const p of remaining) {
    const ok = p.projectTypes.length === 1 && p.projectTypes[0] === p.name;
    console.log(`  ${ok ? "✓" : "✗"} ${p.name} → [${p.projectTypes.join(", ")}] (${p._count.contractors} contractors)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
