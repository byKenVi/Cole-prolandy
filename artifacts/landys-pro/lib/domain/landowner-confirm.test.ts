import { describe, expect, it, vi, beforeEach } from "vitest";
import { JobOutcome, LeadMatchStatus } from "@prisma/client";
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

import {
  submitLandownerConfirmation,
  resolveLandownerMismatch,
} from "./landowner-confirm";

function seedConfirmationScenario(db: FakeDb) {
  h.db = db;
  db.lead.seed([{ id: "lead1" }]);
  db.contractor.seed([
    { id: "c1", name: "Alpha Co", contractorTypeId: "ct1" },
    { id: "c2", name: "Beta Co", contractorTypeId: "ct1" },
  ]);
  db.leadMatch.seed([
    {
      id: "m1",
      leadId: "lead1",
      contractorId: "c1",
      status: LeadMatchStatus.ACCEPTED,
      jobOutcome: JobOutcome.WON,
    },
    {
      id: "m2",
      leadId: "lead1",
      contractorId: "c2",
      status: LeadMatchStatus.ACCEPTED,
      jobOutcome: JobOutcome.LOST,
    },
  ]);
  db.landownerConfirmation.seed([
    {
      id: "conf1",
      leadId: "lead1",
      token: "land-tok",
      hired: false,
      mismatchFlagged: false,
      mismatchReason: null,
      respondedAt: null,
    },
  ]);
}

describe("submitLandownerConfirmation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a matching hire without flagging mismatch", async () => {
    const db = createFakeDb();
    seedConfirmationScenario(db);

    const updated = await submitLandownerConfirmation({
      token: "land-tok",
      hired: true,
      hiredLeadMatchId: "m1",
    });

    expect(updated.hired).toBe(true);
    expect(updated.hiredLeadMatchId).toBe("m1");
    expect(updated.mismatchFlagged).toBe(false);
    expect(updated.respondedAt).toBeInstanceOf(Date);
    expect(db.auditLog.rows.some((r) => r.action === "LANDOWNER_CONFIRMATION")).toBe(true);
  });

  it("flags mismatch when landowner hires a contractor who reported lost", async () => {
    const db = createFakeDb();
    seedConfirmationScenario(db);

    const updated = await submitLandownerConfirmation({
      token: "land-tok",
      hired: true,
      hiredLeadMatchId: "m2",
    });

    expect(updated.mismatchFlagged).toBe(true);
    expect(updated.mismatchReason).toContain("reported lost");
  });

  it("flags mismatch when landowner did not hire but a contractor reported won", async () => {
    const db = createFakeDb();
    seedConfirmationScenario(db);

    const updated = await submitLandownerConfirmation({
      token: "land-tok",
      hired: false,
    });

    expect(updated.mismatchFlagged).toBe(true);
    expect(updated.mismatchReason).toContain("did not hire");
  });
});

describe("resolveLandownerMismatch", () => {
  it("clears the flag and writes an audit trail without penalties", async () => {
    const db = createFakeDb();
    seedConfirmationScenario(db);
    db.landownerConfirmation.rows[0].mismatchFlagged = true;
    db.landownerConfirmation.rows[0].mismatchReason = "Test mismatch";

    const updated = await resolveLandownerMismatch({
      confirmationId: "conf1",
      note: "Reviewed with both parties",
      adminId: "admin@test.com",
    });

    expect(updated.mismatchFlagged).toBe(false);
    const audit = db.auditLog.rows.find((r) => r.action === "MISMATCH_RESOLVED");
    expect(audit).toBeTruthy();
    expect(audit?.metadata).toMatchObject({
      leadId: "lead1",
      note: "Reviewed with both parties",
      priorReason: "Test mismatch",
    });
    expect(db.contractor.rows.every((c) => !c.deactivatedAt)).toBe(true);
  });
});
