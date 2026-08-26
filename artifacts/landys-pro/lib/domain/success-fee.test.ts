import { describe, expect, it, vi, beforeEach } from "vitest";
import { LeadMatchStatus, LeadStatus, SuccessFeeStatus } from "@prisma/client";
import { createFakeDb, type FakeDb } from "./__fixtures__/fakeDb";
import { resolveSuccessFeeForValue } from "./success-fee";

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      const target = h.db as unknown as Record<string, unknown>;
      const val = target[prop];
      return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(h.db) : val;
    },
  }),
}));

import { acceptLeadMatch } from "./leads";
import { reportJobWon, confirmContractorPaid } from "./job-outcome";
import { markSuccessFeePaid } from "./success-fee";
import { LeadSoldOutError } from "./errors";

const HOUR = 3600 * 1000;

function seedDistributedLead(db: FakeDb, opts: { maxPurchases?: number }) {
  h.db = db;
  db.appSetting.seed([
    { key: "maxLeadPurchases", value: String(opts.maxPurchases ?? 3) },
    { key: "acceptanceUnlimited", value: "false" },
    { key: "followUpOutcomeDelayHours", value: "72" },
    { key: "followUpPaymentDelayHours", value: "336" },
    { key: "followUpPaymentRetryHours", value: "168" },
  ]);
  db.projectType.seed([{ id: "pt1", contractorTypeId: "ct1" }]);
  db.lead.seed([
    {
      id: "lead1",
      projectTypeId: "pt1",
      tier: 2,
      maxPurchases: opts.maxPurchases ?? 3,
      acceptedCount: 0,
      status: LeadStatus.DISTRIBUTED,
      expiresAt: new Date(Date.now() + HOUR),
      tierReviewRequired: false,
      budgetReviewRequired: false,
      contractorReviewRequired: false,
    },
  ]);
}

function seedMatch(db: FakeDb, id: string, contractorId: string) {
  db.contractor.seed([
    {
      id: contractorId,
      walletBalanceCents: 0,
      contractorTypeId: "ct1",
      deactivatedAt: null,
      createdAt: new Date(),
    },
  ]);
  db.leadMatch.seed([
    {
      id,
      leadId: "lead1",
      contractorId,
      status: LeadMatchStatus.PENDING,
      acceptToken: `tok-${id}`,
      acceptedAt: null,
      jobOutcome: "OPEN",
    },
  ]);
}

describe("success fee tier calculation", () => {
  it("applies 5% under $10k, 4% mid, 3% large", () => {
    const tiers = [
      { sortOrder: 1, maxValueCents: 999_999, rateBasisPoints: 500 },
      { sortOrder: 2, maxValueCents: 2_499_999, rateBasisPoints: 400 },
      { sortOrder: 3, maxValueCents: null, rateBasisPoints: 300 },
    ];
    expect(resolveSuccessFeeForValue(tiers, 500_000).rateBasisPoints).toBe(500);
    expect(resolveSuccessFeeForValue(tiers, 1_500_000).rateBasisPoints).toBe(400);
    expect(resolveSuccessFeeForValue(tiers, 3_000_000).rateBasisPoints).toBe(300);
    expect(resolveSuccessFeeForValue(tiers, 500_000).feeAmountCents).toBe(25_000);
  });
});

describe("acceptance cap without wallet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows exactly three acceptances and blocks the fourth", async () => {
    const db = createFakeDb();
    seedDistributedLead(db, { maxPurchases: 3 });
    for (let i = 1; i <= 4; i += 1) seedMatch(db, `m${i}`, `c${i}`);

    await acceptLeadMatch({ leadMatchId: "m1" });
    await acceptLeadMatch({ leadMatchId: "m2" });
    await acceptLeadMatch({ leadMatchId: "m3" });

    await expect(acceptLeadMatch({ leadMatchId: "m4" })).rejects.toBeInstanceOf(
      LeadSoldOutError,
    );
    expect(db.lead.rows[0].acceptedCount).toBe(3);
  });

  it("handles concurrent acceptances safely", async () => {
    const db = createFakeDb();
    seedDistributedLead(db, { maxPurchases: 3 });
    for (let i = 1; i <= 5; i += 1) seedMatch(db, `m${i}`, `c${i}`);

    const results = await Promise.allSettled(
      ["m1", "m2", "m3", "m4", "m5"].map((id) => acceptLeadMatch({ leadMatchId: id })),
    );
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(3);
    expect(db.lead.rows[0].acceptedCount).toBe(3);
  });
});

describe("success fee lifecycle", () => {
  it("creates AWAITING_CONTRACTOR_PAYMENT on won, DUE only after paid confirm", async () => {
    const db = createFakeDb();
    h.db = db;
    db.successFeeTier.seed([
      { id: "t1", sortOrder: 1, maxValueCents: 999999, rateBasisPoints: 500 },
      { id: "t2", sortOrder: 2, maxValueCents: 2499999, rateBasisPoints: 400 },
      { id: "t3", sortOrder: 3, maxValueCents: null, rateBasisPoints: 300 },
    ]);
    db.appSetting.seed([
      { key: "followUpPaymentDelayHours", value: "336" },
      { key: "followUpPaymentRetryHours", value: "168" },
    ]);
    db.leadMatch.seed([
      {
        id: "match-won",
        leadId: "lead1",
        contractorId: "c1",
        status: LeadMatchStatus.ACCEPTED,
        acceptToken: "tok",
        jobOutcome: "OPEN",
      },
    ]);

    const won = await reportJobWon({
      leadMatchId: "match-won",
      finalContractValueCents: 800_000,
    });
    expect(won.fee.status).toBe(SuccessFeeStatus.AWAITING_CONTRACTOR_PAYMENT);
    expect(won.fee.rateBasisPoints).toBe(500);
    expect(won.fee.feeAmountCents).toBe(40_000);

    const due = await confirmContractorPaid({ leadMatchId: "match-won" });
    expect(due.status).toBe(SuccessFeeStatus.DUE);
  });

  it("admin manual payment marks PAID and writes audit trail", async () => {
    const db = createFakeDb();
    h.db = db;
    db.successFee.seed([
      {
        id: "fee-due",
        leadMatchId: "match-due",
        status: SuccessFeeStatus.DUE,
        rateBasisPoints: 500,
        feeAmountCents: 25_000,
        finalContractValueCents: 500_000,
      },
    ]);

    const paid = await markSuccessFeePaid({
      leadMatchId: "match-due",
      paymentMethod: "manual",
      paidByAdminId: "admin@test.com",
      manualPaymentNote: "Check received",
    });

    expect(paid.status).toBe(SuccessFeeStatus.PAID);
    expect(paid.paymentMethod).toBe("manual");
    expect(paid.manualPaymentNote).toBe("Check received");
    const audit = db.auditLog.rows.find((r) => r.action === "SUCCESS_FEE_PAID");
    expect(audit).toMatchObject({
      actorType: "admin",
      actorId: "admin@test.com",
      targetType: "SuccessFee",
      targetId: "fee-due",
    });
  });
});
