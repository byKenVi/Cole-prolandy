import { describe, it, expect, beforeEach, vi } from "vitest";
import { LeadMatchStatus, LeadStatus, WalletTransactionType } from "@prisma/client";
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

vi.mock("@/lib/services/landowner-confirmation", () => ({
  maybeNotifyLandownerAfterAccept: vi.fn().mockResolvedValue(undefined),
}));

import type { PrismaClient } from "@prisma/client";
import {
  acceptLeadMatch,
  declineLeadMatch,
  refundLeadMatch,
  expireLeads,
  distributeLead,
} from "./leads";
import { InvalidStateError, LeadExpiredError } from "./errors";

const asDb = (db: FakeDb) => db as unknown as PrismaClient;
const HOUR = 3600 * 1000;

function seedScenario(opts: {
  expiresInMs?: number;
  leadStatus?: LeadStatus;
}) {
  const db = createFakeDb();
  h.db = db;

  db.projectType.seed([{ id: "pt1", contractorTypeId: "ct1" }]);
  db.contractor.seed([
    { id: "c1", walletBalanceCents: 0, contractorTypeId: "ct1", deactivatedAt: null, createdAt: new Date() },
    { id: "c2", walletBalanceCents: 0, contractorTypeId: "ct1", deactivatedAt: null, createdAt: new Date(1) },
  ]);

  db.lead.seed([
    {
      id: "lead1",
      landownerName: "Jane Owner",
      landownerEmail: "jane@example.com",
      landownerPhone: "+15550001111",
      propertyLocation: "Austin, TX",
      projectTypeId: "pt1",
      tier: 2,
      priceCents: null,
      maxPurchases: 3,
      acceptedCount: 0,
      status: opts.leadStatus ?? LeadStatus.DISTRIBUTED,
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 24 * HOUR)),
      tierReviewRequired: false,
      budgetReviewRequired: false,
      contractorReviewRequired: false,
    },
  ]);
  return db;
}

function seedMatch(db: FakeDb, id: string, contractorId: string, token: string) {
  db.leadMatch.seed([
    {
      id,
      leadId: "lead1",
      contractorId,
      status: LeadMatchStatus.PENDING,
      acceptToken: token,
      acceptedAt: null,
      jobOutcome: "OPEN",
    },
  ]);
}

describe("acceptLeadMatch — success-fee model (no wallet charge)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets multiple contractors accept and reveals contact without charging", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");
    seedMatch(db, "lm2", "c2", "tok2");

    const r1 = await acceptLeadMatch({ leadMatchId: "lm1" });
    const r2 = await acceptLeadMatch({ acceptToken: "tok2" });

    expect(r1.status).toBe("accepted");
    expect(r2.status).toBe("accepted");
    expect(r1.contact.landownerPhone).toBe("+15550001111");
    expect(db.leadMatch.rows.every((m) => m.status === LeadMatchStatus.ACCEPTED)).toBe(true);
    expect(db.walletTransaction.rows).toHaveLength(0);
  });

  it("accepts without wallet balance (no insufficient balance gate)", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");

    const res = await acceptLeadMatch({ leadMatchId: "lm1" });
    expect(res.status).toBe("accepted");
    expect(db.walletTransaction.rows).toHaveLength(0);
  });

  it("two concurrent accepts of the same match succeed idempotently", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");

    const [a, b] = await Promise.all([
      acceptLeadMatch({ leadMatchId: "lm1" }),
      acceptLeadMatch({ acceptToken: "tok1" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["accepted", "already_accepted"]);
    expect(db.walletTransaction.rows).toHaveLength(0);
    expect(a.contact.landownerPhone).toBe("+15550001111");
    expect(b.contact.landownerPhone).toBe("+15550001111");
  });

  it("is idempotent on repeat accept", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");

    const first = await acceptLeadMatch({ leadMatchId: "lm1" });
    const second = await acceptLeadMatch({ leadMatchId: "lm1" });

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("already_accepted");
  });
});

describe("safe intake distribution gate", () => {
  it("creates no matches while tier and expiry are unresolved", async () => {
    const db = createFakeDb();
    db.projectType.seed([{ id: "pt-review", contractorTypeId: "ct-review" }]);
    db.lead.seed([
      {
        id: "lead-review",
        projectTypeId: "pt-review",
        tier: null,
        priceCents: null,
        expiresAt: null,
        tierReviewRequired: true,
        budgetReviewRequired: true,
        contractorReviewRequired: false,
        status: LeadStatus.NEW,
      },
    ]);
    db.contractor.seed([
      {
        id: "contractor-review",
        name: "Should Not Receive",
        email: "hold@example.com",
        phone: "+15125550100",
        createdAt: new Date(),
        deactivatedAt: null,
        projects: [{ contractorTypeId: "ct-review" }],
      },
    ]);

    await expect(distributeLead(asDb(db), "lead-review")).rejects.toBeInstanceOf(
      InvalidStateError,
    );
    expect(db.leadMatch.rows).toHaveLength(0);
  });
});

describe("declineLeadMatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declines a pending match", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");

    const res = await declineLeadMatch({ leadMatchId: "lm1" });
    expect(res.status).toBe("declined");
    expect(db.leadMatch.rows[0].status).toBe(LeadMatchStatus.DECLINED);
  });

  it("cannot decline after acceptance", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");
    await acceptLeadMatch({ leadMatchId: "lm1" });

    await expect(declineLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });
});

describe("expireLeads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expires stale leads and their pending matches", async () => {
    const db = seedScenario({ expiresInMs: -HOUR });
    seedMatch(db, "lm1", "c1", "tok1");

    const res = await expireLeads(asDb(db));
    expect(res.expiredLeads).toBe(1);
    expect(res.expiredMatches).toBe(1);

    await expect(acceptLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      LeadExpiredError,
    );
  });
});

describe("refundLeadMatch (legacy pay-per-lead only)", () => {
  it("requires a legacy lead charge to refund", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");
    await acceptLeadMatch({ leadMatchId: "lm1" });

    await expect(refundLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });

  it("refunds when a legacy charge exists", async () => {
    const db = seedScenario({});
    seedMatch(db, "lm1", "c1", "tok1");
    await db.walletTransaction.create({
      data: {
        contractorId: "c1",
        amountCents: -4000,
        type: WalletTransactionType.LEAD_CHARGE,
        leadMatchId: "lm1",
      },
    });
    db.leadMatch.rows[0].status = LeadMatchStatus.ACCEPTED;

    const refund = await refundLeadMatch({ leadMatchId: "lm1", reason: "test" });
    expect(refund.refundedCents).toBe(4000);
  });
});
