/**
 * Seed data for Landy's Pro.
 * Run with: npm run db:seed  (or `prisma db seed`)
 *
 * Idempotent for reference data (upserts). Transactional data (leads, matches,
 * wallet transactions, audit) is cleared and recreated on each run.
 */
import { PrismaClient, LeadStatus, LeadMatchStatus } from "@prisma/client";
import { generateAcceptToken } from "../lib/tokens";
import {
  LAND_TYPES,
  PROJECT_CATALOG,
  DEFAULT_PROJECT_PRICES,
} from "../lib/catalog";

const prisma = new PrismaClient();

const dollars = (d: number) => d * 100;

async function main() {
  console.log("Seeding Landy's Pro…");

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

  for (const name of LAND_TYPES) {
    await prisma.landType.upsert({ where: { name }, update: {}, create: { name } });
  }

  const typeIdByName: Record<string, string> = {};
  const projectIdByKey: Record<string, string> = {};

  for (const entry of PROJECT_CATALOG) {
    const typeName = entry.name;
    const prices = entry.prices ?? DEFAULT_PROJECT_PRICES;
    const ct = await prisma.contractorType.upsert({
      where: { name: typeName },
      update: { icon: entry.icon },
      create: { name: typeName, icon: entry.icon },
    });
    typeIdByName[typeName] = ct.id;

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
    projectIdByKey[typeName] = pt.id;

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
        update: { priceCents: dollars(prices[i]!) },
        create: {
          contractorTypeId: ct.id,
          projectTypeId: pt.id,
          tier,
          priceCents: dollars(prices[i]!),
        },
      });
    }
  }

  await prisma.auditLog.deleteMany({});
  await prisma.walletTransaction.deleteMany({});
  await prisma.leadMatch.deleteMany({});
  await prisma.lead.deleteMany({});

  type ContractorSeed = {
    key: string;
    name: string;
    email: string;
    phone: string;
    type: string;
    isPro: boolean;
    isTopPro?: boolean;
    finalBalance: number;
    about?: string;
  };

  const contractorSeeds: ContractorSeed[] = [
    {
      key: "bigsky",
      name: "Big Sky Excavation",
      email: "bigsky@example.com",
      phone: "+15125550101",
      type: "Utility Trenching",
      isPro: true,
      // Demo wallets stay at $0 — fake prepaid would inflate Finance "held" vs real Stripe.
      finalBalance: 0,
      about: "Family-run dirt work since 1998.",
    },
    {
      key: "ridgeline",
      name: "Ridgeline Excavation",
      email: "ridgeline@example.com",
      phone: "+15125550102",
      type: "Land Grading & Leveling",
      isPro: true,
      finalBalance: 0,
    },
    {
      key: "timberline",
      name: "Timberline Land Clearing",
      email: "timberline@example.com",
      phone: "+15125550103",
      type: "Tree Removal & Stump Grinding",
      isPro: true,
      isTopPro: true,
      finalBalance: 0,
      about: "Heavy clearing & mulching specialists.",
    },
    {
      key: "stillwaters",
      name: "Still Waters Ponds",
      email: "stillwaters@example.com",
      phone: "+15125550104",
      type: "Pond Building",
      isPro: true,
      finalBalance: 0,
      about: "Ponds, lakes, and dams.",
    },
    {
      key: "clearwater",
      name: "Clearwater Ponds",
      email: "clearwater@example.com",
      phone: "+15125550105",
      type: "Pond Building",
      isPro: true,
      finalBalance: 0,
    },
    {
      key: "lonestar",
      name: "Lone Star Fencing",
      email: "lonestar@example.com",
      phone: "+15125550106",
      type: "Gated Entrance",
      isPro: false,
      finalBalance: 0,
      about: "Ag & residential fencing.",
    },
    {
      key: "hillcountry",
      name: "Hill Country Drainage",
      email: "hillcountry@example.com",
      phone: "+15125550107",
      type: "Drainage Improvement",
      isPro: true,
      finalBalance: 0,
    },
    {
      key: "redland",
      name: "Redland Roads & Grading",
      email: "redland@example.com",
      phone: "+15125550108",
      type: "Driveway Construction",
      isPro: true,
      finalBalance: 0,
    },
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

    const typeId = typeIdByName[c.type]!;
    await prisma.contractorProject.upsert({
      where: {
        contractorId_contractorTypeId: {
          contractorId: created.id,
          contractorTypeId: typeId,
        },
      },
      update: {},
      create: { contractorId: created.id, contractorTypeId: typeId },
    });
  }

  const priceFor = (typeName: string, tier: number) => {
    const entry = PROJECT_CATALOG.find((p) => p.name === typeName)!;
    const prices = entry.prices ?? DEFAULT_PROJECT_PRICES;
    return dollars(prices[tier - 1]!);
  };

  const now = Date.now();
  const expiry = new Date(now + 48 * 3600 * 1000);

  type LeadSeed = {
    type: string;
    tier: number;
    landowner: { name: string; email: string; phone: string; location: string };
    landType?: string;
    matches: { contractor: string; status: LeadMatchStatus }[];
  };

  const leadSeeds: LeadSeed[] = [
    {
      type: "Utility Trenching",
      tier: 2,
      landowner: {
        name: "Marcus Bell",
        email: "marcus.bell@example.com",
        phone: "+15125559001",
        location: "Dripping Springs, TX",
      },
      landType: "Homestead",
      matches: [
        { contractor: "bigsky", status: LeadMatchStatus.ACCEPTED },
        { contractor: "ridgeline", status: LeadMatchStatus.PENDING },
      ],
    },
    {
      type: "Pond Building",
      tier: 2,
      landowner: {
        name: "Dana Whitfield",
        email: "dana.w@example.com",
        phone: "+15125559002",
        location: "Wimberley, TX",
      },
      landType: "Farmland",
      matches: [
        { contractor: "clearwater", status: LeadMatchStatus.ACCEPTED },
        { contractor: "stillwaters", status: LeadMatchStatus.PENDING },
      ],
    },
    {
      type: "Culvert Install",
      tier: 1,
      landowner: {
        name: "Priya Nair",
        email: "priya.nair@example.com",
        phone: "+15125559003",
        location: "Buda, TX",
      },
      landType: "Development",
      matches: [{ contractor: "hillcountry", status: LeadMatchStatus.PENDING }],
    },
    {
      type: "Tree Removal & Stump Grinding",
      tier: 3,
      landowner: {
        name: "Sam Ortiz",
        email: "sam.ortiz@example.com",
        phone: "+15125559004",
        location: "Blanco, TX",
      },
      landType: "Timberland",
      matches: [{ contractor: "timberline", status: LeadMatchStatus.ACCEPTED }],
    },
    {
      type: "Gated Entrance",
      tier: 1,
      landowner: {
        name: "Grace Lin",
        email: "grace.lin@example.com",
        phone: "+15125559005",
        location: "Kyle, TX",
      },
      landType: "Ranching",
      matches: [{ contractor: "lonestar", status: LeadMatchStatus.PENDING }],
    },
  ];

  const landTypeIdByName: Record<string, string> = {};
  for (const lt of await prisma.landType.findMany()) landTypeIdByName[lt.name] = lt.id;

  // Seed accepts are status-only — no wallet LEAD_CHARGE / TOPUP. Fake ledger
  // rows would disagree with live Stripe on Finance (held vs available).
  for (const ls of leadSeeds) {
    const price = priceFor(ls.type, ls.tier);
    const lead = await prisma.lead.create({
      data: {
        landownerName: ls.landowner.name,
        landownerEmail: ls.landowner.email,
        landownerPhone: ls.landowner.phone,
        propertyLocation: ls.landowner.location,
        projectTypeId: projectIdByKey[ls.type]!,
        landTypeId: ls.landType ? landTypeIdByName[ls.landType] : null,
        tier: ls.tier,
        priceCents: price,
        status: LeadStatus.DISTRIBUTED,
        source: "seed",
        expiresAt: expiry,
      },
    });

    for (const m of ls.matches) {
      const contractorId = contractorIdByKey[m.contractor]!;
      await prisma.leadMatch.create({
        data: {
          leadId: lead.id,
          contractorId,
          status: m.status,
          acceptToken: generateAcceptToken(),
          acceptedAt: m.status === LeadMatchStatus.ACCEPTED ? new Date() : null,
        },
      });
    }
  }

  for (const c of contractorSeeds) {
    await prisma.contractor.update({
      where: { id: contractorIdByKey[c.key]! },
      data: { walletBalanceCents: dollars(c.finalBalance) },
    });
  }

  console.log("Seed complete.");
  console.log(`  ${PROJECT_CATALOG.length} project types, ${LAND_TYPES.length} land types`);
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
