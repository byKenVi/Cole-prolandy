import { describe, expect, it, vi, beforeEach } from "vitest";
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

import type { PrismaClient } from "@prisma/client";
import { acceptLeadMatch, distributeLead } from "./leads";
import { InsufficientBalanceError, LeadSoldOutError } from "./errors";

const asDb = (db: FakeDb) => db as unknown as PrismaClient;
const HOUR = 3600 * 1000;

function seedDistributedLead(db: FakeDb, opts: { maxPurchases?: number; priceCents?: number }) {
  h.db = db;
  db.projectType.seed([{ id: "pt1", contractorTypeId: "ct1" }]);
  db.lead.seed([
    {
      id: "lead1",
      projectTypeId: "pt1",
      tier: 2,
      priceCents: opts.priceCents ?? 4000,
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
      walletBalanceCents: 50000,
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
    },
  ]);
}

describe("first-three purchase cap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows exactly three purchases and blocks the fourth without charging", async () => {
    const db = createFakeDb();
    h.db = db;
    seedDistributedLead(db, { maxPurchases: 3 });
    seedMatch(db, "m1", "c1");
    seedMatch(db, "m2", "c2");
    seedMatch(db, "m3", "c3");
    seedMatch(db, "m4", "c4");
    seedMatch(db, "m5", "c5");

    await acceptLeadMatch({ leadMatchId: "m1" });
    await acceptLeadMatch({ leadMatchId: "m2" });
    await acceptLeadMatch({ leadMatchId: "m3" });

    await expect(acceptLeadMatch({ leadMatchId: "m4" })).rejects.toBeInstanceOf(
      LeadSoldOutError,
    );
    await expect(acceptLeadMatch({ leadMatchId: "m5" })).rejects.toBeInstanceOf(
      LeadSoldOutError,
    );

    expect(db.lead.rows[0].acceptedCount).toBe(3);
    expect(db.lead.rows[0].status).toBe(LeadStatus.SOLD_OUT);
    expect(
      db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.LEAD_CHARGE),
    ).toHaveLength(3);
    expect(db.leadMatch.rows.find((m) => m.id === "m4")?.status).toBe(LeadMatchStatus.SOLD_OUT);
    expect(db.contractor.rows.find((c) => c.id === "c4")?.walletBalanceCents).toBe(50000);
  });

  it("handles concurrent purchase attempts safely", async () => {
    const db = createFakeDb();
    h.db = db;
    seedDistributedLead(db, { maxPurchases: 3 });
    for (let i = 1; i <= 5; i += 1) seedMatch(db, `m${i}`, `c${i}`);

    const results = await Promise.allSettled(
      ["m1", "m2", "m3", "m4", "m5"].map((id) => acceptLeadMatch({ leadMatchId: id })),
    );

    const accepted = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(accepted).toBe(3);
    expect(rejected).toBe(2);
    expect(db.lead.rows[0].acceptedCount).toBe(3);
    expect(
      db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.LEAD_CHARGE),
    ).toHaveLength(3);
  });

  it("does not consume a purchase slot on insufficient balance", async () => {
    const db = createFakeDb();
    h.db = db;
    seedDistributedLead(db, { maxPurchases: 3, priceCents: 4000 });
    db.contractor.rows.push({
      id: "poor",
      walletBalanceCents: 100,
      contractorTypeId: "ct1",
      deactivatedAt: null,
      createdAt: new Date(),
    });
    db.leadMatch.seed([
      {
        id: "poor-match",
        leadId: "lead1",
        contractorId: "poor",
        status: LeadMatchStatus.PENDING,
        acceptToken: "tok-poor",
        acceptedAt: null,
      },
    ]);
    seedMatch(db, "rich-match", "c1");

    await expect(acceptLeadMatch({ leadMatchId: "poor-match" })).rejects.toBeInstanceOf(
      InsufficientBalanceError,
    );
    expect(db.lead.rows[0].acceptedCount).toBe(0);

    await acceptLeadMatch({ leadMatchId: "rich-match" });
    expect(db.lead.rows[0].acceptedCount).toBe(1);
  });
});

describe("all eligible contractor distribution", () => {
  it("creates offers for all eligible contractors", async () => {
    const db = createFakeDb();
    db.projectType.seed([{ id: "pt-all", contractorTypeId: "ct-all" }]);
    db.lead.seed([
      {
        id: "lead-all",
        projectTypeId: "pt-all",
        tier: 1,
        priceCents: 2500,
        maxPurchases: 3,
        acceptedCount: 0,
        expiresAt: new Date(Date.now() + HOUR),
        tierReviewRequired: false,
        budgetReviewRequired: false,
        contractorReviewRequired: false,
        status: LeadStatus.NEW,
      },
    ]);
    db.contractor.seed(
      Array.from({ length: 10 }, (_, index) => ({
        id: `c-${index}`,
        name: `Contractor ${index}`,
        email: `c${index}@example.com`,
        phone: `+1512555010${index}`,
        createdAt: new Date(index),
        deactivatedAt: null,
        projects: [{ contractorTypeId: "ct-all" }],
      })),
    );

    const result = await distributeLead(asDb(db), "lead-all");
    expect(result.matches).toHaveLength(10);
    expect(db.leadMatch.rows).toHaveLength(10);
  });
});
