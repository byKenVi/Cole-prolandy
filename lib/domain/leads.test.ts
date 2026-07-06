import { describe, it, expect, beforeEach, vi } from "vitest";
import { LeadMatchStatus, LeadStatus, WalletTransactionType } from "@prisma/client";
import { createFakeDb, type FakeDb } from "./__fixtures__/fakeDb";

// Mock the prisma singleton so domain functions that open their own transaction
// operate on a fresh in-memory fake per test.
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
import {
  acceptLeadMatch,
  declineLeadMatch,
  refundLeadMatch,
  expireLeads,
} from "./leads";

const asDb = (db: FakeDb) => db as unknown as PrismaClient;
import { InsufficientBalanceError, InvalidStateError, LeadExpiredError } from "./errors";

const HOUR = 3600 * 1000;

function seedScenario(opts: {
  balances: Record<string, number>;
  priceCents: number;
  expiresInMs?: number;
  leadStatus?: LeadStatus;
}) {
  const db = createFakeDb();
  h.db = db;

  Object.entries(opts.balances).forEach(([id, bal]) =>
    db.contractor.seed([{ id, walletBalanceCents: bal, contractorTypeId: "ct1" }]),
  );

  db.lead.seed([
    {
      id: "lead1",
      landownerName: "Jane Owner",
      landownerEmail: "jane@example.com",
      landownerPhone: "+15550001111",
      propertyLocation: "Austin, TX",
      projectTypeId: "pt1",
      tier: 2,
      priceCents: opts.priceCents,
      status: opts.leadStatus ?? LeadStatus.DISTRIBUTED,
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 24 * HOUR)),
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
    },
  ]);
}

describe("acceptLeadMatch — shared lead, multi-accept", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets multiple contractors accept the same lead and charges each", async () => {
    const db = seedScenario({ balances: { c1: 20000, c2: 20000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");
    seedMatch(db, "lm2", "c2", "tok2");

    const r1 = await acceptLeadMatch({ leadMatchId: "lm1" });
    const r2 = await acceptLeadMatch({ acceptToken: "tok2" });

    expect(r1.status).toBe("accepted");
    expect(r2.status).toBe("accepted");
    expect(r1.newBalanceCents).toBe(16000);
    expect(r2.newBalanceCents).toBe(16000);
    // Contact revealed to both.
    expect(r1.contact.landownerPhone).toBe("+15550001111");
    // Both matches accepted, both charged.
    expect(db.leadMatch.rows.every((m) => m.status === LeadMatchStatus.ACCEPTED)).toBe(true);
    expect(
      db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.LEAD_CHARGE),
    ).toHaveLength(2);
  });

  it("blocks accept and does not charge when balance is too low", async () => {
    const db = seedScenario({ balances: { c1: 1000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");

    await expect(acceptLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      InsufficientBalanceError,
    );
    expect(db.contractor.rows[0].walletBalanceCents).toBe(1000);
    expect(db.leadMatch.rows[0].status).toBe(LeadMatchStatus.PENDING);
    expect(db.walletTransaction.rows).toHaveLength(0);
  });

  it("money-safety: two CONCURRENT accepts of the SAME match charge exactly once", async () => {
    // Our two accept surfaces (SMS token link + in-app tap) can hit the same
    // LeadMatch at the same time. Run both as OVERLAPPING transactions via
    // Promise.all — with the fake, each `await` yields, so both read PENDING
    // before either claims. The guarded UPDATE must let exactly one win.
    const db = seedScenario({ balances: { c1: 20000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");

    const [a, b] = await Promise.all([
      acceptLeadMatch({ leadMatchId: "lm1" }), // in-app tap
      acceptLeadMatch({ acceptToken: "tok1" }), // SMS link — SAME match
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["accepted", "already_accepted"]);

    // Charged exactly once.
    expect(
      db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.LEAD_CHARGE),
    ).toHaveLength(1);

    // Wallet debited exactly once (20000 - 4000), not twice.
    expect(db.contractor.rows[0].walletBalanceCents).toBe(16000);

    // Match ends ACCEPTED, and both surfaces report the same final balance.
    expect(db.leadMatch.rows[0].status).toBe(LeadMatchStatus.ACCEPTED);
    expect(a.newBalanceCents).toBe(16000);
    expect(b.newBalanceCents).toBe(16000);

    // Both surfaces reveal the landowner contact; the loser is NOT an error.
    expect(a.contact.landownerPhone).toBe("+15550001111");
    expect(b.contact.landownerPhone).toBe("+15550001111");
  });

  it("is idempotent: a second accept does not double-charge", async () => {
    const db = seedScenario({ balances: { c1: 20000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");

    const first = await acceptLeadMatch({ leadMatchId: "lm1" });
    const second = await acceptLeadMatch({ leadMatchId: "lm1" });

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("already_accepted");
    expect(second.newBalanceCents).toBe(16000);
    expect(
      db.walletTransaction.rows.filter((t) => t.type === WalletTransactionType.LEAD_CHARGE),
    ).toHaveLength(1);
  });
});

describe("declineLeadMatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("declines a pending match for free", async () => {
    const db = seedScenario({ balances: { c1: 20000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");

    const res = await declineLeadMatch({ leadMatchId: "lm1" });
    expect(res.status).toBe("declined");
    expect(db.leadMatch.rows[0].status).toBe(LeadMatchStatus.DECLINED);
    expect(db.walletTransaction.rows).toHaveLength(0);
  });

  it("cannot decline after acceptance", async () => {
    const db = seedScenario({ balances: { c1: 20000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");
    await acceptLeadMatch({ leadMatchId: "lm1" });

    await expect(declineLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });

  it("cannot accept after declining", async () => {
    const db = seedScenario({ balances: { c1: 20000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");
    await declineLeadMatch({ leadMatchId: "lm1" });

    await expect(acceptLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });
});

describe("expireLeads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expires stale leads and their pending matches; accept then fails", async () => {
    const db = seedScenario({
      balances: { c1: 20000 },
      priceCents: 4000,
      expiresInMs: -HOUR, // already past
    });
    seedMatch(db, "lm1", "c1", "tok1");

    const res = await expireLeads(asDb(db));
    expect(res.expiredLeads).toBe(1);
    expect(res.expiredMatches).toBe(1);
    expect(db.leadMatch.rows[0].status).toBe(LeadMatchStatus.EXPIRED);

    await expect(acceptLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      LeadExpiredError,
    );
  });

  it("rejects accepting a lead that is past expiry even before the sweep", async () => {
    const db = seedScenario({
      balances: { c1: 20000 },
      priceCents: 4000,
      expiresInMs: -HOUR,
    });
    seedMatch(db, "lm1", "c1", "tok1");

    await expect(acceptLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      LeadExpiredError,
    );
  });
});

describe("refundLeadMatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refunds an accepted lead charge and blocks a double refund", async () => {
    const db = seedScenario({ balances: { c1: 20000 }, priceCents: 4000 });
    seedMatch(db, "lm1", "c1", "tok1");
    await acceptLeadMatch({ leadMatchId: "lm1" });
    expect(db.contractor.rows[0].walletBalanceCents).toBe(16000);

    const refund = await refundLeadMatch({ leadMatchId: "lm1", reason: "test" });
    expect(refund.refundedCents).toBe(4000);
    expect(refund.newBalanceCents).toBe(20000);

    await expect(refundLeadMatch({ leadMatchId: "lm1" })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });
});
