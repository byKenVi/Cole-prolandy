/**
 * Shared success-fee QA fixtures for local (and optionally staging) reseeds.
 * Current-model only — no wallets, purchase prices, or pay-per-lead tiers.
 */
import type { PrismaClient, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

const categories = [
  ["general-contractor", "General Contractor"],
  ["roofing", "Roofing"],
  ["plumbing", "Plumbing"],
  ["electrical", "Electrical"],
  ["hvac", "HVAC"],
  ["landscaping", "Landscaping"],
  ["flooring", "Flooring"],
  ["painting", "Painting"],
  ["kitchen-bath", "Kitchen & Bath"],
  ["foundation-concrete", "Foundation & Concrete"],
  ["other", "Other"],
] as const;

const workTypes = [
  ["new-build", "New Build"],
  ["renovation-remodel", "Renovation / Remodel"],
  ["repair", "Repair"],
  ["addition", "Addition"],
  ["installation", "Installation"],
  ["maintenance", "Maintenance"],
  ["inspection", "Inspection"],
] as const;

const landTypes = [
  ["residential", "Residential"],
  ["commercial", "Commercial"],
  ["multi-family", "Multi-family"],
  ["rural-land", "Rural / Land"],
] as const;

function daysAgo(days: number, base = new Date()): Date {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export type QaSeedOptions = {
  /** AppSetting environmentName marker value ("local" | "staging"). */
  environmentName: "local" | "staging";
  adminEmail: string;
  adminName?: string;
  contractorEmails: string[];
  /** Stable id prefix so local/staging fixtures do not collide if ever compared. */
  idPrefix: string;
};

async function ensureTaxonomy(tx: Tx) {
  for (const [code, name] of categories) {
    await tx.contractorCategory.upsert({
      where: { code },
      create: { code, name, isActiveForNewIntake: true },
      update: { name, archivedAt: null, isActiveForNewIntake: true },
    });
  }
  for (const [code, name] of workTypes) {
    await tx.workType.upsert({
      where: { code },
      create: { code, name, isActiveForNewIntake: true },
      update: { name, archivedAt: null, isActiveForNewIntake: true },
    });
  }
  for (const [code, name] of landTypes) {
    await tx.landType.upsert({
      where: { code },
      create: { code, name, isActiveForNewIntake: true },
      update: { name, archivedAt: null, isActiveForNewIntake: true },
    });
  }
  for (const [sortOrder, maxValueCents, rateBasisPoints] of [
    [1, 999_999, 500],
    [2, 2_499_999, 400],
    [3, null, 300],
  ] as const) {
    await tx.successFeeTier.upsert({
      where: { sortOrder },
      create: { sortOrder, maxValueCents, rateBasisPoints },
      update: { maxValueCents, rateBasisPoints },
    });
  }
}

async function ensureSettings(tx: Tx, environmentName: "local" | "staging") {
  for (const [key, value] of [
    ["environmentName", environmentName],
    ["acceptanceUnlimited", "false"],
    ["maxLeadPurchases", "3"],
    ["leadExpiryHours", "168"],
    ["followUpOutcomeDelayHours", "72"],
    ["followUpPaymentDelayHours", "336"],
    ["followUpPaymentRetryHours", "168"],
  ] as const) {
    await tx.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}

export async function clearOperationalQaData(db: PrismaClient) {
  await db.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({});
    await tx.processedStripeEvent.deleteMany({});
    await tx.followUpToken.deleteMany({});
    await tx.landownerConfirmation.deleteMany({});
    await tx.successFee.deleteMany({});
    await tx.walletTransaction.deleteMany({});
    await tx.leadMatch.deleteMany({});
    await tx.leadAttachment.deleteMany({});
    await tx.lead.deleteMany({});
    await tx.contractorWorkType.deleteMany({});
    await tx.contractorCategoryMembership.deleteMany({});
    await tx.contractorProject.deleteMany({});
    await tx.externalContractorIdentity.deleteMany({});
    await tx.contractor.deleteMany({});
    await tx.adminInvite.deleteMany({});
    await tx.adminUser.updateMany({ data: { invitedById: null } });
    await tx.adminUser.deleteMany({});
    await tx.priceTier.deleteMany({});
    await tx.workTypePriceTier.deleteMany({});
  }, { maxWait: 20_000, timeout: 120_000 });
}

export async function seedSuccessFeeQaFixtures(db: PrismaClient, opts: QaSeedOptions) {
  const emails = opts.contractorEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length < 4) {
    throw new Error("QA seed requires at least four contractor emails.");
  }
  const adminEmail = opts.adminEmail.trim().toLowerCase();
  if (!adminEmail) throw new Error("QA seed requires an admin email.");
  const p = opts.idPrefix;

  await db.$transaction(async (tx) => {
    await ensureTaxonomy(tx);
    await ensureSettings(tx, opts.environmentName);

    await tx.adminUser.create({
      data: {
        email: adminEmail,
        name: opts.adminName ?? "Local QA Owner",
        role: "OWNER",
      },
    });

    const contractorSpecs = [
      { id: `${p}_c1`, name: "Oak Ridge General", email: emails[0], category: "general-contractor", work: "new-build" },
      { id: `${p}_c2`, name: "Summit Roofing Co", email: emails[1], category: "roofing", work: "repair" },
      { id: `${p}_c3`, name: "Greenway Landscaping", email: emails[2], category: "landscaping", work: "maintenance" },
      { id: `${p}_c4`, name: "Copperline Plumbing", email: emails[3], category: "plumbing", work: "installation" },
    ] as const;

    for (let i = 0; i < contractorSpecs.length; i += 1) {
      const spec = contractorSpecs[i]!;
      const category = await tx.contractorCategory.findUniqueOrThrow({ where: { code: spec.category } });
      const workType = await tx.workType.findUniqueOrThrow({ where: { code: spec.work } });
      await tx.contractor.create({
        data: {
          id: spec.id,
          name: spec.name,
          email: spec.email,
          phone: `+1555555010${i}`,
          contractorCategoryId: category.id,
          walletBalanceCents: 0,
          isPro: i === 0,
          categoryMemberships: { create: { categoryId: category.id, isPrimary: true } },
          workTypes: { create: { workTypeId: workType.id } },
        },
      });
    }

    const residential = await tx.landType.findUniqueOrThrow({ where: { code: "residential" } });
    const general = await tx.contractorCategory.findUniqueOrThrow({ where: { code: "general-contractor" } });
    const roofing = await tx.contractorCategory.findUniqueOrThrow({ where: { code: "roofing" } });
    const landscaping = await tx.contractorCategory.findUniqueOrThrow({ where: { code: "landscaping" } });
    const newBuild = await tx.workType.findUniqueOrThrow({ where: { code: "new-build" } });
    const repair = await tx.workType.findUniqueOrThrow({ where: { code: "repair" } });
    const maintenance = await tx.workType.findUniqueOrThrow({ where: { code: "maintenance" } });
    const now = new Date();

    type FeeStatus = "AWAITING_CONTRACTOR_PAYMENT" | "DUE" | "PAID" | null;
    type MatchStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "SOLD_OUT";

    async function createOpportunity(params: {
      key: string;
      categoryId: string;
      workTypeId: string;
      budgetCents: number;
      location: string;
      landowner: string;
      status?: "NEW" | "DISTRIBUTED" | "SOLD_OUT" | "EXPIRED";
      acceptedCount?: number;
      maxPurchases?: number;
      matches: Array<{
        contractorId: string;
        status: MatchStatus;
        outcome?: "OPEN" | "WON" | "LOST";
        fee?: FeeStatus;
        feeAmountCents?: number;
        rateBps?: number;
        paymentMethod?: string | null;
        paidAt?: Date | null;
        stripePi?: string | null;
        finalValueCents?: number;
      }>;
      confirmation?: {
        hired: boolean | null;
        hiredMatchKey?: string | null;
        responded: boolean;
        mismatch?: boolean;
        mismatchReason?: string | null;
        pending?: boolean;
      };
    }) {
      const leadId = `${p}_lead_${params.key}`;
      const lead = await tx.lead.create({
        data: {
          id: leadId,
          landownerName: params.landowner,
          landownerEmail: `${params.key}@landowner.test`,
          landownerPhone: "+15555550999",
          propertyLocation: params.location,
          propertyZip: "78701",
          description: `Local QA fixture: ${params.key}`,
          budgetBand: "BETWEEN_15K_50K",
          budgetCents: params.budgetCents,
          landTypeId: residential.id,
          contractorCategoryId: params.categoryId,
          workTypeId: params.workTypeId,
          tier: null,
          priceCents: null,
          status: params.status ?? "DISTRIBUTED",
          reviewStatus: "ROUTED",
          tierReviewRequired: false,
          budgetReviewRequired: false,
          pricingReviewRequired: false,
          source: `${opts.environmentName}_seed`,
          externalRequestId: `${opts.environmentName}-${params.key}`,
          acceptedCount: params.acceptedCount ?? params.matches.filter((m) => m.status === "ACCEPTED").length,
          maxPurchases: params.maxPurchases ?? 3,
          routedAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const matchIds: Record<string, string> = {};
      for (const [idx, m] of params.matches.entries()) {
        const matchId = `${p}_match_${params.key}_${idx}`;
        matchIds[`${params.key}_${idx}`] = matchId;
        const accepted = m.status === "ACCEPTED";
        const outcome = m.outcome ?? "OPEN";
        await tx.leadMatch.create({
          data: {
            id: matchId,
            leadId: lead.id,
            contractorId: m.contractorId,
            status: m.status,
            acceptedAt: accepted ? now : null,
            jobOutcome: outcome,
            finalContractValueCents: outcome === "WON" ? (m.finalValueCents ?? params.budgetCents) : null,
            outcomeReportedAt: outcome !== "OPEN" ? now : null,
          },
        });
        if (m.fee) {
          await tx.successFee.create({
            data: {
              leadMatchId: matchId,
              finalValueCents: m.finalValueCents ?? params.budgetCents,
              rateBasisPoints: m.rateBps ?? 400,
              feeAmountCents: m.feeAmountCents ?? Math.round((m.finalValueCents ?? params.budgetCents) * 0.04),
              status: m.fee,
              dueAt: m.fee === "DUE" || m.fee === "PAID" ? (m.paidAt ?? now) : null,
              paidAt: m.fee === "PAID" ? (m.paidAt ?? now) : null,
              paymentMethod: m.fee === "PAID" ? (m.paymentMethod ?? "stripe") : null,
              stripePaymentIntentId: m.fee === "PAID" ? (m.stripePi ?? null) : null,
              manualPaymentNote:
                m.fee === "PAID" && m.paymentMethod === "manual"
                  ? "Local QA offline check payment"
                  : null,
            },
          });
        }
      }

      if (params.confirmation) {
        const hiredMatchId =
          params.confirmation.hiredMatchKey != null
            ? matchIds[params.confirmation.hiredMatchKey] ?? null
            : null;
        await tx.landownerConfirmation.create({
          data: {
            leadId: lead.id,
            token: `${p}_confirm_${params.key}`,
            hired: params.confirmation.pending ? null : params.confirmation.hired,
            hiredLeadMatchId: hiredMatchId,
            respondedAt: params.confirmation.responded ? now : null,
            mismatchFlagged: Boolean(params.confirmation.mismatch),
            mismatchReason: params.confirmation.mismatchReason ?? null,
          },
        });
      }
    }

    // New / open opportunity
    await createOpportunity({
      key: "open",
      categoryId: general.id,
      workTypeId: newBuild.id,
      budgetCents: 18_000_00,
      location: "Georgetown, TX",
      landowner: "Alex Rivera",
      matches: [{ contractorId: `${p}_c1`, status: "PENDING" }],
    });

    // Accepted (contact revealed path)
    await createOpportunity({
      key: "accepted",
      categoryId: general.id,
      workTypeId: newBuild.id,
      budgetCents: 22_500_00,
      location: "Round Rock, TX",
      landowner: "Jordan Lee",
      matches: [{ contractorId: `${p}_c1`, status: "ACCEPTED", outcome: "OPEN" }],
      confirmation: { hired: null, responded: false, pending: true },
    });

    // Passed / declined
    await createOpportunity({
      key: "passed",
      categoryId: landscaping.id,
      workTypeId: maintenance.id,
      budgetCents: 8_500_00,
      location: "Cedar Park, TX",
      landowner: "Sam Patel",
      matches: [{ contractorId: `${p}_c3`, status: "DECLINED", outcome: "OPEN" }],
    });

    // Max acceptance (3 accepted → sold out feel)
    await createOpportunity({
      key: "capped",
      categoryId: general.id,
      workTypeId: newBuild.id,
      budgetCents: 35_000_00,
      location: "Austin, TX",
      landowner: "Casey Nguyen",
      status: "SOLD_OUT",
      maxPurchases: 3,
      acceptedCount: 3,
      matches: [
        { contractorId: `${p}_c1`, status: "ACCEPTED" },
        { contractorId: `${p}_c2`, status: "ACCEPTED" },
        { contractorId: `${p}_c4`, status: "ACCEPTED" },
        { contractorId: `${p}_c3`, status: "SOLD_OUT" },
      ],
    });

    // Lost job
    await createOpportunity({
      key: "lost",
      categoryId: roofing.id,
      workTypeId: repair.id,
      budgetCents: 12_000_00,
      location: "Pflugerville, TX",
      landowner: "Riley Brooks",
      matches: [{ contractorId: `${p}_c2`, status: "ACCEPTED", outcome: "LOST" }],
    });

    // Won → awaiting contractor payment
    await createOpportunity({
      key: "awaiting",
      categoryId: general.id,
      workTypeId: newBuild.id,
      budgetCents: 28_000_00,
      location: "Leander, TX",
      landowner: "Morgan Ellis",
      matches: [
        {
          contractorId: `${p}_c1`,
          status: "ACCEPTED",
          outcome: "WON",
          fee: "AWAITING_CONTRACTOR_PAYMENT",
          finalValueCents: 28_000_00,
          rateBps: 300,
          feeAmountCents: 840_00,
        },
      ],
    });

    // Fee due
    await createOpportunity({
      key: "due",
      categoryId: general.id,
      workTypeId: newBuild.id,
      budgetCents: 15_000_00,
      location: "Kyle, TX",
      landowner: "Taylor Kim",
      matches: [
        {
          contractorId: `${p}_c1`,
          status: "ACCEPTED",
          outcome: "WON",
          fee: "DUE",
          finalValueCents: 15_000_00,
          rateBps: 400,
          feeAmountCents: 600_00,
        },
      ],
    });

    // Paid via Stripe
    await createOpportunity({
      key: "paid_stripe",
      categoryId: landscaping.id,
      workTypeId: maintenance.id,
      budgetCents: 9_500_00,
      location: "Buda, TX",
      landowner: "Jamie Cruz",
      matches: [
        {
          contractorId: `${p}_c3`,
          status: "ACCEPTED",
          outcome: "WON",
          fee: "PAID",
          finalValueCents: 9_500_00,
          rateBps: 500,
          feeAmountCents: 475_00,
          paymentMethod: "stripe",
          stripePi: `pi_${p}_stripe_1`,
          paidAt: daysAgo(2),
        },
      ],
      confirmation: {
        hired: true,
        hiredMatchKey: "paid_stripe_0",
        responded: true,
      },
    });

    // Paid manually
    await createOpportunity({
      key: "paid_manual",
      categoryId: general.id,
      workTypeId: newBuild.id,
      budgetCents: 42_000_00,
      location: "Dripping Springs, TX",
      landowner: "Avery Quinn",
      matches: [
        {
          contractorId: `${p}_c1`,
          status: "ACCEPTED",
          outcome: "WON",
          fee: "PAID",
          finalValueCents: 42_000_00,
          rateBps: 300,
          feeAmountCents: 1_260_00,
          paymentMethod: "manual",
          paidAt: daysAgo(5),
        },
      ],
    });

    // Mismatch confirmation
    await createOpportunity({
      key: "mismatch",
      categoryId: general.id,
      workTypeId: newBuild.id,
      budgetCents: 19_000_00,
      location: "Manor, TX",
      landowner: "Drew Santos",
      matches: [
        { contractorId: `${p}_c1`, status: "ACCEPTED", outcome: "WON", fee: "DUE", feeAmountCents: 760_00 },
        { contractorId: `${p}_c2`, status: "ACCEPTED", outcome: "OPEN" },
      ],
      confirmation: {
        hired: true,
        hiredMatchKey: "mismatch_1",
        responded: true,
        mismatch: true,
        mismatchReason:
          "Oak Ridge General reported this job as Won, but the landowner selected Summit Roofing Co.",
      },
    });

    // Chart series: paid success fees across 7 / 30 / 90 day windows
    const chartDays = [1, 3, 6, 10, 14, 21, 28, 35, 45, 60, 75, 88];
    for (const [i, day] of chartDays.entries()) {
      const key = `chart_${day}`;
      const value = 10_000_00 + i * 1_250_00;
      const fee = Math.round(value * 0.04);
      await createOpportunity({
        key,
        categoryId: general.id,
        workTypeId: newBuild.id,
        budgetCents: value,
        location: `Chartville District ${day}, TX`,
        landowner: `Chart Landowner ${day}`,
        matches: [
          {
            contractorId: `${p}_c${(i % 4) + 1}`,
            status: "ACCEPTED",
            outcome: "WON",
            fee: "PAID",
            finalValueCents: value,
            rateBps: 400,
            feeAmountCents: fee,
            paymentMethod: i % 3 === 0 ? "manual" : "stripe",
            stripePi: i % 3 === 0 ? null : `pi_${p}_chart_${day}`,
            paidAt: daysAgo(day),
          },
        ],
      });
    }
  }, { maxWait: 20_000, timeout: 120_000 });
}
