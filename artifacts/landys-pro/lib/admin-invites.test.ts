import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminInvite: { findFirst: mocks.findFirst, update: vi.fn(() => "update-op") },
    adminUser: { upsert: vi.fn(() => "upsert-op") },
    auditLog: { create: vi.fn(() => "audit-op") },
    $transaction: mocks.transaction,
  },
}));

import { claimPendingAdminInvite } from "@/lib/admin-invites";

describe("claimPendingAdminInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction returns results positionally; the upsert is first.
    mocks.transaction.mockResolvedValue([{ id: "admin_1", role: "ADMIN" }, null, null]);
  });

  it("does not touch the database when the user has no verified email", async () => {
    const result = await claimPendingAdminInvite({
      clerkUserId: "user_1",
      verifiedEmails: [],
    });

    expect(result).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when no pending invitation matches", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await claimPendingAdminInvite({
      clerkUserId: "user_1",
      verifiedEmails: ["nobody@example.com"],
    });

    expect(result).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("only considers pending, unexpired invitations for the given emails", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await claimPendingAdminInvite({
      clerkUserId: "user_1",
      verifiedEmails: ["Owner@Example.com"],
    });

    const where = mocks.findFirst.mock.calls[0][0].where;
    expect(where.status).toBe("PENDING");
    expect(where.email).toEqual({ in: ["Owner@Example.com"], mode: "insensitive" });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("grants the invited role and consumes the invitation atomically", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "inv_1",
      email: "New.Owner@Example.com",
      name: "New Owner",
      role: "OWNER",
      invitedById: "admin_0",
    });
    mocks.transaction.mockResolvedValue([{ id: "admin_9", role: "OWNER" }, null, null]);

    const result = await claimPendingAdminInvite({
      clerkUserId: "user_9",
      verifiedEmails: ["new.owner@example.com"],
    });

    expect(result).toEqual({ id: "admin_9", role: "OWNER" });
    // Upsert, invite status change and audit entry share a single transaction.
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction.mock.calls[0][0]).toHaveLength(3);
  });
});
