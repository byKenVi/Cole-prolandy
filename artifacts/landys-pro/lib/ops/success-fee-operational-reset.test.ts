import { describe, expect, it } from "vitest";
import {
  OPERATIONAL_AUDIT_ACTIONS,
  assertPreservationInvariants,
  buildResetPlan,
  formatResetReport,
  type ResetCounts,
} from "./success-fee-operational-reset";

function sampleCounts(overrides: Partial<ResetCounts> = {}): ResetCounts {
  return {
    contractors: 42,
    canonicalCategories: 11,
    canonicalWorkTypes: 7,
    canonicalCategoryMemberships: 40,
    canonicalWorkTypeMappings: 38,
    admins: 2,
    appSettings: 12,
    successFeeTiers: 3,
    leads: 17,
    leadMatches: 51,
    leadAttachments: 4,
    successFees: 9,
    landownerConfirmations: 5,
    followUpTokens: 8,
    walletTransactions: 22,
    contractorsWithWalletBalance: 6,
    walletBalanceCentsTotal: 125000,
    priceTiers: 30,
    workTypePriceTiers: 21,
    operationalAuditLogs: 100,
    obsoleteCategories: 3,
    obsoleteWorkTypes: 2,
    ...overrides,
  };
}

describe("success-fee operational reset planning", () => {
  it("builds a dry-run plan without execute flag", () => {
    const plan = buildResetPlan(sampleCounts(), false);
    expect(plan.mode).toBe("dry-run");
    expect(plan.preserve.contractors).toBe(42);
    expect(plan.preserve.canonicalCategories).toBe(11);
    expect(plan.preserve.canonicalWorkTypes).toBe(7);
    expect(plan.preserve.successFeeTiers).toBe(3);
    expect(plan.remove.leads).toBe(17);
    expect(plan.remove.walletTransactions).toBe(22);
    expect(plan.remove.priceTiers).toBe(30);
    expect(plan.remove.walletBalancesToZero).toBe(6);
  });

  it("builds an execute plan with the same remove targets", () => {
    const plan = buildResetPlan(sampleCounts(), true);
    expect(plan.mode).toBe("execute");
    expect(plan.remove.successFees).toBe(9);
    expect(plan.remove.landownerConfirmations).toBe(5);
  });

  it("formats a readable report with preservation lines", () => {
    const report = formatResetReport(buildResetPlan(sampleCounts(), false));
    expect(report).toContain("Contractors preserved: 42");
    expect(report).toContain("Canonical categories preserved: 11");
    expect(report).toContain("Canonical work types preserved: 7");
    expect(report).toContain("Leads to delete: 17");
    expect(report).toContain("live-v3.ts");
  });

  it("lists operational audit actions only (not auth/security)", () => {
    expect(OPERATIONAL_AUDIT_ACTIONS).toContain("LEAD_ACCEPTED");
    expect(OPERATIONAL_AUDIT_ACTIONS).toContain("SUCCESS_FEE_PAID");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("ADMIN_LOGIN");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("CONTRACTOR_DEACTIVATED");
    // Real security/account/Wix audit action strings used in production code.
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("contractor.deactivated.admin");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("contractor.reactivated.admin");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("contractor.clerk.unlinked");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("ADMIN_INVITED");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("ADMIN_DISABLED");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("ADMIN_ROLE_CHANGED");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("wix.contractor_sync.completed");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("wix.contractor_id.deprecated_alias");
    expect(OPERATIONAL_AUDIT_ACTIONS).not.toContain("SETTING_UPDATED");
  });
});

describe("assertPreservationInvariants", () => {
  it("passes when contractors/taxonomy/settings survive and ops are zeroed", () => {
    const before = sampleCounts();
    const after = sampleCounts({
      leads: 0,
      leadMatches: 0,
      leadAttachments: 0,
      successFees: 0,
      landownerConfirmations: 0,
      followUpTokens: 0,
      walletTransactions: 0,
      contractorsWithWalletBalance: 0,
      walletBalanceCentsTotal: 0,
      priceTiers: 0,
      workTypePriceTiers: 0,
      operationalAuditLogs: 0,
    });
    expect(() => assertPreservationInvariants(before, after)).not.toThrow();
  });

  it("fails if contractors were deleted", () => {
    const before = sampleCounts();
    const after = sampleCounts({
      contractors: 41,
      leads: 0,
      leadMatches: 0,
      successFees: 0,
      landownerConfirmations: 0,
      followUpTokens: 0,
      walletTransactions: 0,
      walletBalanceCentsTotal: 0,
      priceTiers: 0,
      workTypePriceTiers: 0,
    });
    expect(() => assertPreservationInvariants(before, after)).toThrow(/contractors/);
  });

  it("fails if leads remain after reset", () => {
    const before = sampleCounts();
    const after = sampleCounts({
      leads: 1,
      leadMatches: 0,
      successFees: 0,
      landownerConfirmations: 0,
      followUpTokens: 0,
      walletTransactions: 0,
      walletBalanceCentsTotal: 0,
      priceTiers: 0,
      workTypePriceTiers: 0,
    });
    expect(() => assertPreservationInvariants(before, after)).toThrow(/leads/);
  });

  it("fails if wallet balances are not zeroed", () => {
    const before = sampleCounts();
    const after = sampleCounts({
      leads: 0,
      leadMatches: 0,
      successFees: 0,
      landownerConfirmations: 0,
      followUpTokens: 0,
      walletTransactions: 0,
      walletBalanceCentsTotal: 500,
      priceTiers: 0,
      workTypePriceTiers: 0,
    });
    expect(() => assertPreservationInvariants(before, after)).toThrow(/wallet/);
  });
});
