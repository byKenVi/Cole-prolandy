import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authMode: vi.fn(),
  createInvitation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ authMode: mocks.authMode }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    invitations: { createInvitation: mocks.createInvitation },
  })),
}));

import {
  sendAdminInvitation,
  sendContractorAccountInvitation,
} from "@/lib/contractor-invitations";

describe("sendAdminInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://pro.landys.test");
    mocks.authMode.mockReturnValue("clerk");
  });

  it("points the invitation at sign-up, where the ticket only asks for a password", async () => {
    mocks.createInvitation.mockResolvedValue({ id: "inv_1" });

    const result = await sendAdminInvitation({
      email: "owner@example.com",
      name: "New Owner",
      token: "tok_abc",
    });

    expect(result).toEqual({ ok: true, provider: "clerk" });
    // Must NOT be /admin/invite: an invitee has no account yet, and that page
    // sends unauthenticated visitors to /sign-in, which fails "account not found".
    expect(mocks.createInvitation).toHaveBeenCalledWith({
      emailAddress: "owner@example.com",
      redirectUrl: "https://pro.landys.test/sign-up",
      ignoreExisting: true,
      publicMetadata: { role: "admin", adminName: "New Owner" },
    });
  });

  it("treats an address Clerk already knows as a soft success", async () => {
    mocks.createInvitation.mockRejectedValue({
      errors: [{ code: "duplicate_record", message: "already exists" }],
    });

    const result = await sendAdminInvitation({
      email: "known@example.com",
      name: "Known",
      token: "tok_known",
    });

    // The AdminInvite row still grants access on next sign-in, so this must not
    // surface as a failure to the inviter.
    expect(result).toEqual({
      ok: true,
      provider: "clerk",
      note: "existing-account",
      inviteUrl: "https://pro.landys.test/admin/invite?token=tok_known",
    });
  });

  it("reports a genuine Clerk outage as a failure", async () => {
    mocks.createInvitation.mockRejectedValue(new Error("503 upstream unavailable"));

    const result = await sendAdminInvitation({
      email: "owner@example.com",
      name: "Owner",
      token: "tok_x",
    });

    expect(result).toEqual({ ok: false, error: "503 upstream unavailable" });
  });

  it("sends no email in dev auth mode and returns the link instead", async () => {
    mocks.authMode.mockReturnValue("dev");

    const result = await sendAdminInvitation({
      email: "owner@example.com",
      name: "Owner",
      token: "tok_dev",
    });

    expect(result).toEqual({
      ok: true,
      provider: "dev",
      note: "dev-no-email",
      inviteUrl: "https://pro.landys.test/admin/invite?token=tok_dev",
    });
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });
});

describe("sendContractorAccountInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://pro.landys.test");
    mocks.authMode.mockReturnValue("clerk");
  });

  it("uses Clerk invitation for a new user", async () => {
    mocks.createInvitation.mockResolvedValue({ id: "inv_1" });

    const result = await sendContractorAccountInvitation({
      name: "Acme Land",
      email: "pro@example.com",
    });

    expect(result).toEqual({ ok: true, provider: "clerk" });
    expect(mocks.createInvitation).toHaveBeenCalledWith({
      emailAddress: "pro@example.com",
      redirectUrl: "https://pro.landys.test/sign-up",
      ignoreExisting: true,
      publicMetadata: { role: "contractor", contractorName: "Acme Land" },
    });
  });

  it("does not contact live providers in dev auth mode", async () => {
    mocks.authMode.mockReturnValue("dev");

    await expect(
      sendContractorAccountInvitation({ name: "Acme", email: "pro@example.com" }),
    ).resolves.toEqual({ ok: true, provider: "dev" });
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });
});
