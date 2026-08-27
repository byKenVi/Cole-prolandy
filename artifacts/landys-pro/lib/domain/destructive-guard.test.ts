import { describe, it, expect, vi, beforeEach } from "vitest";

const countMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { count: (...args: unknown[]) => countMock(...args) } },
}));

import { assertNoDestructiveBurst } from "./destructive-guard";
import { DestructiveBurstError } from "./errors";

describe("assertNoDestructiveBurst", () => {
  beforeEach(() => {
    countMock.mockReset();
  });

  it("allows the action when recent count is below the threshold", async () => {
    countMock.mockResolvedValue(4);
    await expect(
      assertNoDestructiveBurst({ actorId: "admin@example.com", action: "contractor.deactivated.admin" }),
    ).resolves.toBeUndefined();
  });

  it("blocks the action once recent count reaches the threshold", async () => {
    countMock.mockResolvedValue(5);
    await expect(
      assertNoDestructiveBurst({ actorId: "admin@example.com", action: "contractor.deactivated.admin" }),
    ).rejects.toBeInstanceOf(DestructiveBurstError);
  });

  it("scopes the count query to the actor, the action, and a recent time window", async () => {
    countMock.mockResolvedValue(0);
    await assertNoDestructiveBurst({ actorId: "admin@example.com", action: "contractor.deleted.admin" });
    expect(countMock).toHaveBeenCalledTimes(1);
    const call = countMock.mock.calls[0][0] as {
      where: { actorId: string; action: string; createdAt: { gte: Date } };
    };
    expect(call.where.actorId).toBe("admin@example.com");
    expect(call.where.action).toBe("contractor.deleted.admin");
    expect(call.where.createdAt.gte.getTime()).toBeLessThanOrEqual(Date.now());
    expect(call.where.createdAt.gte.getTime()).toBeGreaterThan(Date.now() - 3 * 60 * 1000);
  });

  it("treats a null actorId as a stable key instead of crashing", async () => {
    countMock.mockResolvedValue(0);
    await expect(
      assertNoDestructiveBurst({ actorId: null, action: "LEAD_REFUNDED" }),
    ).resolves.toBeUndefined();
    const call = countMock.mock.calls[0][0] as { where: { actorId: string } };
    expect(call.where.actorId).toBe("unknown-admin");
  });
});
