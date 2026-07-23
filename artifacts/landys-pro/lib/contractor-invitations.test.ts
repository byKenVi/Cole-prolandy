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

import { sendContractorAccountInvitation } from "@/lib/contractor-invitations";

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
