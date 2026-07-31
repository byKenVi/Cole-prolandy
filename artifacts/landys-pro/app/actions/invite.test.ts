/**
 * Unit tests for the admin invite acceptance flow (acceptInvitation server action).
 *
 * Tests the core logic of acceptInvitation() by mocking Prisma and the auth layer.
 * Covers: happy path, not-signed-in guard, invalid token, already-accepted,
 * expired (status field), expired (past expiresAt), and email mismatch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Module-level hoisted mocks ────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const adminInvite = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const adminUser = {
    upsert: vi.fn(),
  };
  const auditLog = {
    create: vi.fn(),
  };

  return {
    getSession: vi.fn(),
    revalidatePath: vi.fn(),
    prisma: { adminInvite, adminUser, auditLog },
  };
});

// Stub Next.js server-only primitives that would error outside the Next runtime.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(),
  getSession: mocks.getSession,
}));
// Stub email / app-url so they don't run in tests.
vi.mock("@/lib/integrations/email", () => ({
  email: { send: vi.fn().mockResolvedValue({ ok: true }) },
}));
vi.mock("@/lib/app-url", () => ({ appUrl: vi.fn().mockReturnValue("https://test.example") }));

// Import after mocks are registered.
import { acceptInvitation } from "@/app/actions/team";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const PAST = new Date(Date.now() - 1000); // 1 second ago

/** A well-formed PENDING invite record. */
const VALID_INVITE = {
  id: "invite_1",
  email: "newadmin@example.com",
  name: "New Admin",
  role: "ADMIN" as const,
  token: "valid-token",
  status: "PENDING" as const,
  expiresAt: FUTURE,
  invitedById: null,
};

/** A signed-in session for the correct user. */
const SIGNED_IN_SESSION = {
  userId: "clerk_user_1",
  email: "newadmin@example.com",
  role: "contractor" as const,
  contractorId: null,
  viewingAs: false,
  needsOnboarding: false,
  deactivated: false,
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe("acceptInvitation()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: prisma calls succeed silently.
    mocks.prisma.adminUser.upsert.mockResolvedValue({});
    mocks.prisma.adminInvite.update.mockResolvedValue({});
    mocks.prisma.auditLog.create.mockResolvedValue({});
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("accepts a valid invite and creates the AdminUser record", async () => {
    mocks.getSession.mockResolvedValue(SIGNED_IN_SESSION);
    mocks.prisma.adminInvite.findUnique.mockResolvedValue(VALID_INVITE);

    const result = await acceptInvitation("valid-token");

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/accepted/i);

    // AdminUser created with the Clerk user id.
    expect(mocks.prisma.adminUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "newadmin@example.com" },
        create: expect.objectContaining({ clerkUserId: "clerk_user_1" }),
        update: expect.objectContaining({ clerkUserId: "clerk_user_1" }),
      }),
    );

    // Invite status flipped to ACCEPTED.
    expect(mocks.prisma.adminInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "valid-token" },
        data: expect.objectContaining({ status: "ACCEPTED" }),
      }),
    );

    // Audit log written.
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ADMIN_INVITE_ACCEPTED" }),
      }),
    );
  });

  it("grants access to /admin after acceptance (AdminUser row exists with correct clerkUserId)", async () => {
    mocks.getSession.mockResolvedValue(SIGNED_IN_SESSION);
    mocks.prisma.adminInvite.findUnique.mockResolvedValue(VALID_INVITE);

    const upsertSpy = mocks.prisma.adminUser.upsert;
    await acceptInvitation("valid-token");

    // The upsert both creates and updates with the correct clerkUserId,
    // so getClerkSession() will find this user as an admin on the next request.
    const createArgs = upsertSpy.mock.calls[0][0].create;
    expect(createArgs.clerkUserId).toBe("clerk_user_1");
    expect(createArgs.role).toBe("ADMIN");
    expect(createArgs.email).toBe("newadmin@example.com");
  });

  // ── Guard: not signed in ────────────────────────────────────────────────────

  it("rejects when the user is not signed in", async () => {
    mocks.getSession.mockResolvedValue({
      ...SIGNED_IN_SESSION,
      userId: null,
      email: null,
    });
    mocks.prisma.adminInvite.findUnique.mockResolvedValue(VALID_INVITE);

    const result = await acceptInvitation("valid-token");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/signed in/i);
    expect(mocks.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  // ── Invalid / missing token ─────────────────────────────────────────────────

  it("rejects an unrecognised token", async () => {
    mocks.getSession.mockResolvedValue(SIGNED_IN_SESSION);
    mocks.prisma.adminInvite.findUnique.mockResolvedValue(null);

    const result = await acceptInvitation("made-up-token");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/invalid invitation/i);
    expect(mocks.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  // ── Already accepted ────────────────────────────────────────────────────────

  it("rejects a token that has already been accepted", async () => {
    mocks.getSession.mockResolvedValue(SIGNED_IN_SESSION);
    mocks.prisma.adminInvite.findUnique.mockResolvedValue({
      ...VALID_INVITE,
      status: "ACCEPTED",
    });

    const result = await acceptInvitation("already-used-token");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already been accepted/i);
    expect(mocks.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  // ── Revoked token ───────────────────────────────────────────────────────────

  it("rejects a revoked invitation", async () => {
    mocks.getSession.mockResolvedValue(SIGNED_IN_SESSION);
    mocks.prisma.adminInvite.findUnique.mockResolvedValue({
      ...VALID_INVITE,
      status: "REVOKED",
    });

    const result = await acceptInvitation("revoked-token");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/revoked/i);
    expect(mocks.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  // ── Expired: status field already set ──────────────────────────────────────

  it("rejects an invite whose status is already EXPIRED", async () => {
    mocks.getSession.mockResolvedValue(SIGNED_IN_SESSION);
    mocks.prisma.adminInvite.findUnique.mockResolvedValue({
      ...VALID_INVITE,
      status: "EXPIRED",
    });

    const result = await acceptInvitation("expired-token");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/expired/i);
    expect(mocks.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  // ── Expired: past expiresAt but status still PENDING ───────────────────────

  it("rejects and marks EXPIRED when expiresAt is in the past", async () => {
    mocks.getSession.mockResolvedValue(SIGNED_IN_SESSION);
    mocks.prisma.adminInvite.findUnique.mockResolvedValue({
      ...VALID_INVITE,
      expiresAt: PAST, // token is past its TTL
    });

    const result = await acceptInvitation("stale-token");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/expired/i);

    // Should have persisted the EXPIRED status.
    expect(mocks.prisma.adminInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "stale-token" },
        data: { status: "EXPIRED" },
      }),
    );
    expect(mocks.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  // ── Wrong email ─────────────────────────────────────────────────────────────

  it("rejects when the signed-in user's email does not match the invite", async () => {
    mocks.getSession.mockResolvedValue({
      ...SIGNED_IN_SESSION,
      email: "someone-else@example.com",
    });
    mocks.prisma.adminInvite.findUnique.mockResolvedValue(VALID_INVITE);

    const result = await acceptInvitation("valid-token");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/newadmin@example\.com/);
    expect(mocks.prisma.adminUser.upsert).not.toHaveBeenCalled();
  });

  // ── Case-insensitive email matching ────────────────────────────────────────

  it("accepts when the email matches case-insensitively", async () => {
    mocks.getSession.mockResolvedValue({
      ...SIGNED_IN_SESSION,
      email: "NewAdmin@Example.COM", // different casing
    });
    mocks.prisma.adminInvite.findUnique.mockResolvedValue(VALID_INVITE);

    const result = await acceptInvitation("valid-token");

    expect(result.ok).toBe(true);
  });
});
