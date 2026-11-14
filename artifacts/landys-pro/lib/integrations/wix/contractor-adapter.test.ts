import { describe, expect, it } from "vitest";
import {
  normalizeWixContractorRecord,
  normalizeWixContractorStatus,
  resolveOfficialCategoryCode,
} from "@/lib/integrations/wix/contractor-adapter";

/** The All-Contractors item from landys.co's Payload Reference Guide (display-name keys). */
const PDF_ITEM = {
  "Company Name": "Caddo Lake Forestry Co",
  ID: "03b2cdb7-b6c0-4856-bb14-022327a92ab6",
  _id: "03b2cdb7-b6c0-4856-bb14-022327a92ab6",
  "All Contractors (Item)": "/all-contractors/caddo-lake-forestry-co",
  "Contractor ID": "CTR-1029",
  "Short Description": "Forestry & Timber pro serving Sabine County, TX.",
  "Long Description": "Caddo Lake Forestry Co is a trusted forestry & timber contractor.",
  Phone: "936-242-6129",
  Email: "contact@caddo-lake-forestry-co.com",
  WebsiteURL: "https://www.caddo-lake-forestry-co.com",
  "Top Pro Badge": true,
  Verified: "Yes",
  "Contractors Category": ["Land Lenders"],
  "Secondary Categories": ["Outdoor Renovation"],
  "Land Types": ["Large Lots", "Residential"],
  "Project Type": ["Outdoor Living Spaces", "Patio Installation", "Retaining Walls"],
  "Service Zip Codes": "75204, 75205, 75212",
  "Service Counties": "Sabine County",
  "Pro Portal ID": "PP-2029",
  Status: "Active",
  Featured: "No",
};

describe("wix contractor adapter", () => {
  it("maps the PDF item written with display names", () => {
    const n = normalizeWixContractorRecord(PDF_ITEM);
    expect(n.record.externalId).toBe("03b2cdb7-b6c0-4856-bb14-022327a92ab6");
    expect(n.record.profile).toMatchObject({
      name: "Caddo Lake Forestry Co",
      email: "contact@caddo-lake-forestry-co.com",
      phone: "936-242-6129",
    });
    expect(n.categoryLabels).toEqual(["Land Lenders", "Outdoor Renovation"]);
    expect(n.record.contractorCategoryCode).toBe("land-lenders");
    expect(n.serviceZipCodes).toEqual(["75204", "75205", "75212"]);
    expect(n.serviceCounties).toEqual(["Sabine County"]);
    expect(n.websiteUrl).toBe("https://www.caddo-lake-forestry-co.com");
    expect(n.isActive).toBe(true);
    expect(n.metadata).toMatchObject({ contractorId: "CTR-1029", proPortalId: "PP-2029", verified: true, featured: false });
  });

  it("maps the same item written with API field keys", () => {
    const n = normalizeWixContractorRecord({
      _id: "2f768032-8281-4a38-9d3c-bfc7cd499b74",
      title: "Acme Roofing",
      email: "ACME@Example.com",
      phone: "+15125550100",
      contractorsCategory: ["Roofing"],
      serviceZipCodes: ["78701", "78702"],
      serviceCounties: ["Travis County, TX; Hays County, TX"],
      status: "Active",
    });
    expect(n.record.profile?.name).toBe("Acme Roofing");
    expect(n.record.profile?.email).toBe("acme@example.com");
    expect(n.record.contractorCategoryCode).toBe("roofing");
    expect(n.serviceZipCodes).toEqual(["78701", "78702"]);
    expect(n.serviceCounties).toEqual(["Travis County, TX", "Hays County, TX"]);
  });

  it("treats a missing status as active and anything else explicit as inactive", () => {
    expect(normalizeWixContractorStatus(undefined)).toBe("active");
    expect(normalizeWixContractorStatus("Active")).toBe("active");
    expect(normalizeWixContractorStatus("Inactive")).toBe("inactive");
    expect(normalizeWixContractorStatus("Suspended")).toBe("inactive");
  });

  it("turns any category label into a stable slug", () => {
    expect(resolveOfficialCategoryCode("Roofing")).toBe("roofing");
    expect(resolveOfficialCategoryCode("Kitchen & Bath")).toBe("kitchen-bath");
    expect(resolveOfficialCategoryCode("Dirt Work & Excavation")).toBe("dirt-work-excavation");
    expect(resolveOfficialCategoryCode("  ")).toBeNull();
  });
});
