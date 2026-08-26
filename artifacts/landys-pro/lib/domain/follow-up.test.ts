import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  FollowUpAction,
  JobOutcome,
  LeadMatchStatus,
  SuccessFeeStatus,
} from "@prisma/client";
import { createFakeDb, type FakeDb } from "./__fixtures__/fakeDb";

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
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { consumeFollowUpToken } from "./follow-up";
import {
  followUpReportWonAction,
  followUpReportLostAction,
  followUpConfirmPaidAction,
  followUpDeferPaidAction,
} from "@/app/actions/follow-up";

function seedFollowUpMatch(db: FakeDb, opts: { outcome?: JobOutcome; feeStatus?: SuccessFeeStatus }) {
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
  db.lead.seed([{ id: "lead1" }]);
  db.contractor.seed([{ id: "c1", contractorTypeId: "ct1" }]);
  db.leadMatch.seed([
    {
      id: "match1",
      leadId: "lead1",
      contractorId: "c1",
      status: LeadMatchStatus.ACCEPTED,
      acceptToken: "tok",
      jobOutcome: opts.outcome ?? JobOutcome.OPEN,
      followUpStage: "outcome_check",
    },
  ]);
  if (opts.feeStatus) {
    db.successFee.seed([
      {
        id: "fee1",
        leadMatchId: "match1",
        status: opts.feeStatus,
        rateBasisPoints: 500,
        feeAmountCents: 40_000,
        finalContractValueCents: 800_000,
      },
    ]);
  }
}

function seedToken(
  db: FakeDb,
  action: FollowUpAction,
  token = "fu-tok",
) {
  db.followUpToken.seed([
    {
      id: "ft1",
      token,
      action,
      leadMatchId: "match1",
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    },
  ]);
}

describe("consumeFollowUpToken", () => {
  it("marks a valid token as used and rejects reuse", async () => {
    const db = createFakeDb();
    seedFollowUpMatch(db, {});
    seedToken(db, FollowUpAction.REPORT_OUTCOME);

    const row = await consumeFollowUpToken("fu-tok");
    expect(row.action).toBe(FollowUpAction.REPORT_OUTCOME);
    expect(db.followUpToken.rows[0].usedAt).toBeInstanceOf(Date);

    await expect(consumeFollowUpToken("fu-tok")).rejects.toThrow(/already been used/);
  });
});

describe("follow-up magic-link actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("report won transitions match to WON and creates AWAITING fee", async () => {
    const db = createFakeDb();
    seedFollowUpMatch(db, {});
    seedToken(db, FollowUpAction.REPORT_OUTCOME);

    const res = await followUpReportWonAction("fu-tok", 8000);
    expect(res).toEqual({ ok: true, status: "won" });
    expect(db.leadMatch.rows[0].jobOutcome).toBe(JobOutcome.WON);
    expect(db.successFee.rows[0]?.status).toBe(SuccessFeeStatus.AWAITING_CONTRACTOR_PAYMENT);
  });

  it("report lost transitions match to LOST", async () => {
    const db = createFakeDb();
    seedFollowUpMatch(db, {});
    seedToken(db, FollowUpAction.REPORT_OUTCOME, "lost-tok");

    const res = await followUpReportLostAction("lost-tok");
    expect(res).toEqual({ ok: true, status: "lost" });
    expect(db.leadMatch.rows[0].jobOutcome).toBe(JobOutcome.LOST);
  });

  it("confirm paid transitions fee to DUE", async () => {
    const db = createFakeDb();
    seedFollowUpMatch(db, {
      outcome: JobOutcome.WON,
      feeStatus: SuccessFeeStatus.AWAITING_CONTRACTOR_PAYMENT,
    });
    seedToken(db, FollowUpAction.CONFIRM_PAID, "pay-tok");

    const res = await followUpConfirmPaidAction("pay-tok");
    expect(res).toEqual({ ok: true, status: "fee_due" });
    expect(db.successFee.rows[0].status).toBe(SuccessFeeStatus.DUE);
  });

  it("defer paid schedules a payment retry follow-up", async () => {
    const db = createFakeDb();
    seedFollowUpMatch(db, {
      outcome: JobOutcome.WON,
      feeStatus: SuccessFeeStatus.AWAITING_CONTRACTOR_PAYMENT,
    });
    seedToken(db, FollowUpAction.CONFIRM_PAID, "defer-tok");

    const res = await followUpDeferPaidAction("defer-tok");
    expect(res).toEqual({ ok: true, status: "deferred" });
    expect(db.leadMatch.rows[0].followUpStage).toBe("awaiting_contractor_payment");
    expect(db.leadMatch.rows[0].followUpNextAt).toBeInstanceOf(Date);
  });
});
