import { describe, expect, it, vi, beforeEach } from "vitest";
import { LeadMatchStatus, LeadStatus } from "@prisma/client";
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

import { acceptLeadMatch } from "./leads";
import { LeadSoldOutError } from "./errors";

const HOUR = 3600 * 1000;

function seedDistributedLead(db: FakeDb, opts: { maxPurchases?: number }) {
  h.db = db;
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

describe("acceptance cap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows exactly three acceptances and blocks the fourth", async () => {
    const db = createFakeDb();
    seedDistributedLead(db, { maxPurchases: 3 });
    seedMatch(db, "m1", "c1");
    seedMatch(db, "m2", "c2");
    seedMatch(db, "m3", "c3");
    seedMatch(db, "m4", "c4");

    await acceptLeadMatch({ leadMatchId: "m1" });
    await acceptLeadMatch({ leadMatchId: "m2" });
    await acceptLeadMatch({ leadMatchId: "m3" });

    await expect(acceptLeadMatch({ leadMatchId: "m4" })).rejects.toBeInstanceOf(
      LeadSoldOutError,
    );

    expect(db.lead.rows[0].acceptedCount).toBe(3);
    expect(db.lead.rows[0].status).toBe(LeadStatus.SOLD_OUT);
    expect(db.leadMatch.rows.find((m) => m.id === "m4")?.status).toBe(LeadMatchStatus.SOLD_OUT);
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

describe("unlimited acceptance mode", () => {
  it("allows more than maxPurchases when unlimited is enabled", async () => {
    const db = createFakeDb();
    h.db = db;
    db.appSetting.rows.find((r) => r.key === "acceptanceUnlimited")!.value = "true";
    seedDistributedLead(db, { maxPurchases: 3 });
    for (let i = 1; i <= 4; i += 1) seedMatch(db, `m${i}`, `c${i}`);

    await acceptLeadMatch({ leadMatchId: "m1" });
    await acceptLeadMatch({ leadMatchId: "m2" });
    await acceptLeadMatch({ leadMatchId: "m3" });
    await acceptLeadMatch({ leadMatchId: "m4" });

    expect(db.lead.rows[0].acceptedCount).toBe(4);
    expect(db.lead.rows[0].status).not.toBe(LeadStatus.SOLD_OUT);
  });
});
