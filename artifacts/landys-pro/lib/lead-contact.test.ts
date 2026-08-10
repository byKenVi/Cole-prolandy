import { LeadMatchStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canRevealLeadContact } from "./lead-contact";

describe("lead contact visibility", () => {
  it("keeps contact masked before a valid purchase", () => {
    expect(canRevealLeadContact(LeadMatchStatus.PENDING)).toBe(false);
    expect(canRevealLeadContact(LeadMatchStatus.DECLINED)).toBe(false);
    expect(canRevealLeadContact(LeadMatchStatus.EXPIRED)).toBe(false);
  });

  it("reveals contact only for an accepted match", () => {
    expect(canRevealLeadContact(LeadMatchStatus.ACCEPTED)).toBe(true);
  });
});
