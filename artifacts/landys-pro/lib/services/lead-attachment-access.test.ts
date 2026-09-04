import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/replit-object-storage", () => ({
  getAppObjectDownloadUrl: vi.fn(async () => "https://storage.example/signed"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leadMatch: {
      findFirst: vi.fn(async () => null),
    },
    leadAttachment: {
      findFirst: vi.fn(async () => null),
    },
  },
}));

import { getContractorLeadAttachmentDownload } from "./lead-attachment-access";

describe("lead attachment access", () => {
  it("denies access before purchase", async () => {
    const result = await getContractorLeadAttachmentDownload({
      contractorId: "c1",
      leadId: "l1",
      attachmentId: "a1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });
});
