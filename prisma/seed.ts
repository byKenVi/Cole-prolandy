/**
 * Seed data for Landy's Pro.
 * Run with: npm run db:seed  (or `prisma db seed`)
 *
 * Idempotent for reference data (upserts). Transactional data (leads, matches,
 * wallet transactions, audit) is cleared and recreated on each run.
 */
import { PrismaClient, LeadStatus, LeadMatchStatus, WalletTransactionType } from "@prisma/client";
import { generateAcceptToken } from "../lib/tokens";

const prisma = new PrismaClient();

// ── Taxonomy ─────────────────────────────────────────────────

const LAND_TYPES = [
  "Residential Lot",
  "Farm / Ranch",
  "Wooded Acreage",
  "Waterfront",
  "Commercial Parcel",
  "Recreational Land",
];

// contractorType -> { services, projects: { name, prices:[t1,t2,t3] in dollars } }
const CATALOG: Record<
  string,
  { services: string[]; projects: { name: string; prices: [number, number, number] }[] }
> = {
  "Excavation / Dirt Work": {
    services: ["Site excavation", "Foundation digging", "Trenching", "Backfill & compaction"],
    projects: [
      { name: "Site Excavation", prices: [60, 110, 180] },
      { name: "Foundation Dig", prices: [70, 120, 190] },
      { name: "Trenching", prices: [40, 70, 110] },
    ],
  },
  "Land Clearing": {
    services: ["Brush clearing", "Tree & stump removal", "Lot clearing", "Debris hauling"],
    projects: [
      { name: "Brush & Undergrowth Clearing", prices: [50, 90, 150] },
      { name: "Tree & Stump Removal", prices: [80, 140, 220] },
      { name: "Lot Clearing", prices: [70, 120, 200] },
    ],
  },
  "Pond Building": {
    services: ["Pond excavation", "Dredging & cleanout", "Dam / levee construction"],
    projects: [
      { name: "Pond Excavation", prices: [120, 180, 260] },
      { name: "Pond Dredging / Cleanout", prices: [90, 140, 200] },
      { name: "Dam / Levee Construction", prices: [130, 200, 280] },
    ],
  },
  Fencing: {
    services: ["Farm & field fence", "Privacy fence", "Gate installation"],
    projects: [
      { name: "Farm / Field Fence", prices: [40, 70, 120] },
      { name: "Privacy Fence", prices: [50, 90, 150] },
      { name: "Gate Installation", prices: [30, 50, 80] },
    ],
  },
  Surveying: {
    services: ["Boundary survey", "Topographic survey", "Subdivision plat"],
    projects: [
      { name: "Boundary Survey", prices: [50, 90, 140] },
      { name: "Topographic Survey", prices: [70, 120, 190] },
      { name: "Plat / Subdivision Survey", prices: [90, 150, 230] },
    ],
  },
  "Tree Service": {
    services: ["Tree removal", "Stump grinding", "Trimming & pruning"],
    projects: [
      { name: "Tree Removal", prices: [50, 90, 150] },
      { name: "Stump Grinding", prices: [30, 55, 90] },
      { name: "Lot Tree Trimming", prices: [40, 70, 110] },
    ],
  },
  "Road / Driveway": {
    services: ["Gravel driveway install", "Grading & repair", "Culvert & road base"],
    projects: [
      { name: "Gravel Driveway Install", prices: [50, 90, 150] },
      { name: "Driveway Grading / Repair", prices: [40, 70, 110] },
      { name: "Culvert & Road Base", prices: [60, 100, 160] },
    ],
  },
  "Drainage / Culvert": {
    services: ["Culvert installation", "French drains", "Drainage grading"],
    projects: [
      { name: "Culvert Installation", prices: [40, 60, 90] },
      { name: "French Drain", prices: [50, 80, 120] },
      { name: "Drainage Grading", prices: [45, 75, 115] },
    ],
  },
  "Brush Mowing": {
    services: ["Field & pasture mowing", "Right-of-way mowing", "Forestry mulching"],
    projects: [
      { name: "Field / Pasture Mowing", prices: [30, 55, 90] },
      { name: "Right-of-Way Mowing", prices: [35, 60, 100] },
      { name: "Forestry Mulching", prices: [70, 120, 190] },
    ],
  },
  Septic: {
    services: ["Septic install", "Septic repair", "Perc test / site eval"],
    projects: [
      { name: "Septic System Install", prices: [90, 150, 240] },
      { name: "Septic Repair", prices: [60, 100, 160] },
      { name: "Perc Test / Site Eval", prices: [40, 70, 110] },
    ],
  },
  Grading: {
    services: ["Site grading", "Building pad prep", "Finish grading"],
    projects: [
      { name: "Site Grading", prices: [60, 100, 160] },
      { name: "Pad / Building Prep", prices: [70, 120, 190] },
      { name: "Finish Grading", prices: [50, 85, 130] },
    ],
  },
  "Well Drilling": {
    services: ["Water well drilling", "Pump install / repair", "Well site evaluation"],
    projects: [
      { name: "Water Well Drilling", prices: [120, 190, 270] },
      { name: "Well Pump Install / Repair", prices: [70, 120, 180] },
      { name: "Well Site Evaluation", prices: [50, 85, 130] },
    ],
  },
};

// Default 3D icon key (base filename in /public/icons) per seeded category.
const ICON_BY_TYPE: Record<string, string> = {
  "Excavation / Dirt Work": "excavation",
  "Land Clearing": "land-clearing",
  "Pond Building": "pond",
  Fencing: "fencing",
  Surveying: "surveying",
  "Tree Service": "tree-service",
  "Road / Driveway": "road",
  "Drainage / Culvert": "drainage",
  "Brush Mowing": "brush-mowing",
  Septic: "septic",
  Grading: "grading",
  "Well Drilling": "well-drilling",
};

const dollars = (d: number) => d * 100;

async function main() {
  console.log("Seeding Landy's Pro…");

  // ── App settings ──
  const settings = [
    { key: "maxLeadRecipients", value: process.env.DEFAULT_MAX_LEAD_RECIPIENTS ?? "3" },
    { key: "leadExpiryHours", value: process.env.DEFAULT_LEAD_EXPIRY_HOURS ?? "48" },
  ];
  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // ── Land types ──
  for (const name of LAND_TYPES) {
    await prisma.landType.upsert({ where: { name }, update: {}, create: { name } });
  }

  // ── Contractor types + services + project types + price tiers ──
  const typeIdByName: Record<string, string> = {};
  const projectIdByKey: Record<string, string> = {}; // `${typeName}::${projectName}` -> id

  for (const [typeName, def] of Object.entries(CATALOG)) {
    const icon = ICON_BY_TYPE[typeName] ?? "auto";
    const ct = await prisma.contractorType.upsert({
      where: { name: typeName },
      update: { icon },
      create: { name: typeName, icon },
    });
    typeIdByName[typeName] = ct.id;

    for (const svc of def.services) {
      await prisma.service.upsert({
        where: { name_contractorTypeId: { name: svc, contractorTypeId: ct.id } },
        update: {},
        create: { name: svc, contractorTypeId: ct.id },
      });
    }

    for (const proj of def.projects) {
      const pt = await prisma.projectType.upsert({
        where: { name_contractorTypeId: { name: proj.name, contractorTypeId: ct.id } },
        update: {},
        create: { name: proj.name, contractorTypeId: ct.id },
      });
      projectIdByKey[`${typeName}::${proj.name}`] = pt.id;

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
          update: { priceCents: dollars(proj.prices[i]) },
          create: {
            contractorTypeId: ct.id,
            projectTypeId: pt.id,
            tier,
            priceCents: dollars(proj.prices[i]),
          },
        });
      }
    }
  }

  // ── Clear transactional data for a clean reseed ──
  await prisma.auditLog.deleteMany({});
  await prisma.walletTransaction.deleteMany({});
  await prisma.leadMatch.deleteMany({});
  await prisma.lead.deleteMany({});

  // ── Contractors ──
  type ContractorSeed = {
    key: string;
    name: string;
    email: string;
    phone: string;
    type: string;
    isPro: boolean;
    isTopPro?: boolean;
    finalBalance: number; // dollars
    about?: string;
  };

  const contractorSeeds: ContractorSeed[] = [
    { key: "bigsky", name: "Big Sky Excavation", email: "bigsky@example.com", phone: "+15125550101", type: "Excavation / Dirt Work", isPro: true, finalBalance: 250, about: "Family-run dirt work since 1998." },
    { key: "ridgeline", name: "Ridgeline Excavation", email: "ridgeline@example.com", phone: "+15125550102", type: "Excavation / Dirt Work", isPro: true, finalBalance: 150 },
    { key: "timberline", name: "Timberline Land Clearing", email: "timberline@example.com", phone: "+15125550103", type: "Land Clearing", isPro: true, isTopPro: true, finalBalance: 500, about: "Heavy clearing & mulching specialists." },
    { key: "stillwaters", name: "Still Waters Ponds", email: "stillwaters@example.com", phone: "+15125550104", type: "Pond Building", isPro: true, finalBalance: 60, about: "Ponds, lakes, and dams." },
    { key: "clearwater", name: "Clearwater Ponds", email: "clearwater@example.com", phone: "+15125550105", type: "Pond Building", isPro: true, finalBalance: 300 },
    { key: "lonestar", name: "Lone Star Fencing", email: "lonestar@example.com", phone: "+15125550106", type: "Fencing", isPro: false, finalBalance: 0, about: "Ag & residential fencing." },
    { key: "hillcountry", name: "Hill Country Drainage", email: "hillcountry@example.com", phone: "+15125550107", type: "Drainage / Culvert", isPro: true, finalBalance: 120 },
    { key: "redland", name: "Redland Roads & Grading", email: "redland@example.com", phone: "+15125550108", type: "Road / Driveway", isPro: true, finalBalance: 80 },
  ];

  const contractorIdByKey: Record<string, string> = {};
  for (const c of contractorSeeds) {
    const created = await prisma.contractor.upsert({
      where: { email: c.email },
      update: {
        name: c.name,
        phone: c.phone,
        contractorTypeId: typeIdByName[c.type],
        isPro: c.isPro,
        isTopPro: c.isTopPro ?? false,
        aboutSection: c.about ?? null,
        businessHours: "Mon–Fri 7am–6pm",
        walletBalanceCents: 0,
      },
      create: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        contractorTypeId: typeIdByName[c.type],
        isPro: c.isPro,
        isTopPro: c.isTopPro ?? false,
        aboutSection: c.about ?? null,
        businessHours: "Mon–Fri 7am–6pm",
        walletBalanceCents: 0,
      },
    });
    contractorIdByKey[c.key] = created.id;

    // Attach a couple of services from the contractor's type.
    const svcs = await prisma.service.findMany({
      where: { contractorTypeId: typeIdByName[c.type] },
      take: 3,
    });
    for (const s of svcs) {
      await prisma.contractorService.upsert({
        where: { contractorId_serviceId: { contractorId: created.id, serviceId: s.id } },
        update: {},
        create: { contractorId: created.id, serviceId: s.id },
      });
    }
  }

  // ── Leads + matches + wallet history ──
  const priceFor = (typeName: string, projectName: string, tier: number) =>
    dollars(CATALOG[typeName].projects.find((p) => p.name === projectName)!.prices[tier - 1]);

  const now = Date.now();
  const expiry = new Date(now + 48 * 3600 * 1000);

  type LeadSeed = {
    type: string;
    project: string;
    tier: number;
    landowner: { name: string; email: string; phone: string; location: string };
    landType?: string;
    matches: { contractor: string; status: LeadMatchStatus }[];
  };

  const leadSeeds: LeadSeed[] = [
    {
      type: "Excavation / Dirt Work",
      project: "Site Excavation",
      tier: 2,
      landowner: { name: "Marcus Bell", email: "marcus.bell@example.com", phone: "+15125559001", location: "Dripping Springs, TX" },
      landType: "Residential Lot",
      matches: [
        { contractor: "bigsky", status: LeadMatchStatus.ACCEPTED },
        { contractor: "ridgeline", status: LeadMatchStatus.PENDING },
      ],
    },
    {
      type: "Pond Building",
      project: "Pond Excavation",
      tier: 2,
      landowner: { name: "Dana Whitfield", email: "dana.w@example.com", phone: "+15125559002", location: "Wimberley, TX" },
      landType: "Farm / Ranch",
      matches: [
        { contractor: "clearwater", status: LeadMatchStatus.ACCEPTED },
        { contractor: "stillwaters", status: LeadMatchStatus.PENDING },
      ],
    },
    {
      type: "Drainage / Culvert",
      project: "Culvert Installation",
      tier: 1,
      landowner: { name: "Priya Nair", email: "priya.nair@example.com", phone: "+15125559003", location: "Buda, TX" },
      landType: "Residential Lot",
      matches: [{ contractor: "hillcountry", status: LeadMatchStatus.PENDING }],
    },
    {
      type: "Land Clearing",
      project: "Lot Clearing",
      tier: 3,
      landowner: { name: "Sam Ortiz", email: "sam.ortiz@example.com", phone: "+15125559004", location: "Blanco, TX" },
      landType: "Wooded Acreage",
      matches: [{ contractor: "timberline", status: LeadMatchStatus.ACCEPTED }],
    },
    {
      type: "Fencing",
      project: "Farm / Field Fence",
      tier: 1,
      landowner: { name: "Grace Lin", email: "grace.lin@example.com", phone: "+15125559005", location: "Kyle, TX" },
      landType: "Farm / Ranch",
      matches: [{ contractor: "lonestar", status: LeadMatchStatus.PENDING }],
    },
  ];

  const landTypeIdByName: Record<string, string> = {};
  for (const lt of await prisma.landType.findMany()) landTypeIdByName[lt.name] = lt.id;

  // Track charges per contractor to compute their opening top-up.
  const chargesByContractor: Record<string, number> = {};

  for (const ls of leadSeeds) {
    const price = priceFor(ls.type, ls.project, ls.tier);
    const lead = await prisma.lead.create({
      data: {
        landownerName: ls.landowner.name,
        landownerEmail: ls.landowner.email,
        landownerPhone: ls.landowner.phone,
        propertyLocation: ls.landowner.location,
        projectTypeId: projectIdByKey[`${ls.type}::${ls.project}`],
        landTypeId: ls.landType ? landTypeIdByName[ls.landType] : null,
        tier: ls.tier,
        priceCents: price,
        status: LeadStatus.DISTRIBUTED,
        source: "seed",
        expiresAt: expiry,
      },
    });

    for (const m of ls.matches) {
      const contractorId = contractorIdByKey[m.contractor];
      const match = await prisma.leadMatch.create({
        data: {
          leadId: lead.id,
          contractorId,
          status: m.status,
          acceptToken: generateAcceptToken(),
          acceptedAt: m.status === LeadMatchStatus.ACCEPTED ? new Date() : null,
        },
      });

      if (m.status === LeadMatchStatus.ACCEPTED) {
        chargesByContractor[m.contractor] = (chargesByContractor[m.contractor] ?? 0) + price;
        await prisma.walletTransaction.create({
          data: {
            contractorId,
            amountCents: -price,
            type: WalletTransactionType.LEAD_CHARGE,
            leadMatchId: match.id,
            note: `Lead: ${ls.project}`,
          },
        });
      }
    }
  }

  // Opening top-up = final balance + charges. Then set final balance.
  for (const c of contractorSeeds) {
    const charges = chargesByContractor[c.key] ?? 0;
    const finalCents = dollars(c.finalBalance);
    const topUp = finalCents + charges;
    const contractorId = contractorIdByKey[c.key];
    if (topUp > 0) {
      await prisma.walletTransaction.create({
        data: {
          contractorId,
          amountCents: topUp,
          type: WalletTransactionType.TOPUP,
          note: "Initial wallet funding",
          createdAt: new Date(now - 7 * 24 * 3600 * 1000),
        },
      });
    }
    await prisma.contractor.update({
      where: { id: contractorId },
      data: { walletBalanceCents: finalCents },
    });
  }

  console.log("Seed complete.");
  console.log(`  ${Object.keys(CATALOG).length} contractor types, ${LAND_TYPES.length} land types`);
  console.log(`  ${contractorSeeds.length} contractors, ${leadSeeds.length} leads`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
