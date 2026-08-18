import { describe, expect, it } from "vitest";
import {
  normalizeWixContractorRecord,
  resolveOfficialCategoryCode,
  resolveOfficialProjectTypeCode,
  resolveOfficialWorkTypeCode,
} from "@/lib/integrations/wix/contractor-adapter";

describe("wix contractor adapter", () => {
  it("maps live v3 and legacy category labels", () => {
    expect(resolveOfficialCategoryCode("Land Clearing")).toBe("land-clearing");
    expect(resolveOfficialCategoryCode("Landscaping")).toBe("landscaping");
    expect(resolveOfficialProjectTypeCode("CABIN  CONSTRUCTION")).toBe("cabin-construction");
    expect(resolveOfficialWorkTypeCode("Repair")).toBe("repair");
  });

  it("uses Wix _id as canonical external id", () => {
    const normalized = normalizeWixContractorRecord({
      _id: "2f768032-8281-4a38-9d3c-bfc7cd499b74",
      contractorId: "CTR-123",
      proPortalId: "PP-456",
      companyName: "Acme Land",
      email: "acme@example.com",
      phone: "+15125550100",
      status: "Active",
      contractorsCategory: ["Builders"],
      projectType: ["Repair"],
    });

    expect(normalized.record.externalId).toBe("2f768032-8281-4a38-9d3c-bfc7cd499b74");
    expect(normalized.record.contractorCategoryCode).toBe("builders");
    expect(normalized.record.workTypeCodes).toEqual(["repair"]);
    expect(normalized.isActive).toBe(true);
    expect(normalized.metadata.contractorId).toBe("CTR-123");
  });

  it("reports unknown taxonomy values without inventing codes", () => {
    const normalized = normalizeWixContractorRecord({
      _id: "abc",
      companyName: "Test",
      email: "test@example.com",
      phone: "+15125550100",
      status: "Inactive",
      contractorsCategory: ["Outdoor Construction"],
      projectType: ["Patio Installation"],
    });

    expect(normalized.unresolvedCategories).toEqual(["Outdoor Construction"]);
    expect(normalized.unresolvedWorkTypes).toEqual(["Patio Installation"]);
    expect(normalized.isActive).toBe(false);
  });
});
