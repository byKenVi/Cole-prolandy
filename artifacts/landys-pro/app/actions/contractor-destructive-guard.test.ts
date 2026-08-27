/**
 * Regression coverage for the Aug 26-27 2026 mass-deactivation incident.
 *
 * Verifies, through the real deactivateContractor/reactivateContractor/deleteContractor
 * server actions (not just the isolated guard helper):
 *  - a single admin deactivate/reactivate still works normally (the guard must never
 *    block a normal one-off admin action), and
 *  - a rapid burst of the same destructive action by the same admin is refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const contractor = { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const auditLog = { create: vi.fn(), count: vi.fn() };
  return {
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    contractor,
    auditLog,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contractor: mocks.contractor,
    auditLog: mocks.auditLog,
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({ contractor: mocks.contractor, auditLog: mocks.auditLog }),
  },
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/revalidate", () => ({
  revalidateAdminShell: vi.fn(),
  revalidateContractorShell: vi.fn(),
}));
vi.mock("@/lib/domain/leads", () => ({ refundLeadMatch: vi.fn() }));
vi.mock("@/lib/services/recharge", () => ({ chargeContractorSavedCard: vi.fn() }));
vi.mock("@/lib/services/lead-intake", () => ({
  createAndDistributeLead: vi.fn(),
  finalizeLeadForRouting: vi.fn(),
}));
vi.mock("@/lib/phone", () => ({ normalizePhoneForStorage: vi.fn((v: string) => v) }));
vi.mock("@/lib/project-icons", () => ({ ICON_KEYS: [], ICON_AUTO: "auto", ICON_NONE: "none" }));
vi.mock("@/lib/contractor-invitations", () => ({ sendContractorAccountInvitation: vi.fn() }));
vi.mock("@/lib/taxonomy", () => ({ availableIntegrationCode: vi.fn() }));

import { deactivateContractor, reactivateContractor, deleteContractor } from "./admin";

const ADMIN = { role: "admin" as const, email: "admin@example.com", contractorId: null };

describe("destructive contractor actions vs. burst guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.auditLog.count.mockResolvedValue(0); // no recent bursts by default
    mocks.contractor.findUnique.mockResolvedValue({
      id: "c1",
      name: "Test Co",
      deactivatedAt: null,
      walletBalanceCents: 0,
      _count: { walletTransactions: 0, leadMatches: 0 },
    });
    mocks.contractor.update.mockResolvedValue({});
    mocks.auditLog.create.mockResolvedValue({});
  });

  it("allows a normal single deactivate", async () => {
    const res = await deactivateContractor("c1");
    expect(res.ok).toBe(true);
    expect(mocks.contractor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: { deactivatedAt: expect.any(Date) } }),
    );
  });

  it("allows a normal single reactivate", async () => {
    mocks.contractor.findUnique.mockResolvedValue({
      id: "c1",
      name: "Test Co",
      deactivatedAt: new Date(),
    });
    const res = await reactivateContractor("c1");
    expect(res.ok).toBe(true);
  });

  it("blocks deactivation once this admin has hit the recent-burst threshold", async () => {
    mocks.auditLog.count.mockResolvedValue(5); // already 5 in the last window
    const res = await deactivateContractor("c1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/too many/i);
    expect(mocks.contractor.update).not.toHaveBeenCalled();
  });

  it("blocks delete once this admin has hit the recent-burst threshold, independent of deactivate's counter", async () => {
    mocks.auditLog.count.mockImplementation(({ where }: { where: { action: string } }) =>
      Promise.resolve(where.action === "contractor.deleted.admin" ? 5 : 0),
    );
    const res = await deleteContractor("c1");
    expect(res.ok).toBe(false);
    // A deactivate right after should still be unaffected (different action counter).
    const deactivateRes = await deactivateContractor("c1");
    expect(deactivateRes.ok).toBe(true);
  });

  it("does not block reactivate even during a deactivate burst (reactivation is not gated)", async () => {
    mocks.auditLog.count.mockImplementation(({ where }: { where: { action: string } }) =>
      Promise.resolve(where.action === "contractor.deactivated.admin" ? 5 : 0),
    );
    mocks.contractor.findUnique.mockResolvedValue({
      id: "c1",
      name: "Test Co",
      deactivatedAt: new Date(),
    });
    const res = await reactivateContractor("c1");
    expect(res.ok).toBe(true);
  });
});
