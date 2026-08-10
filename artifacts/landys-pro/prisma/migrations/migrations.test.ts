import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(
    join(process.cwd(), "prisma", "migrations", name, "migration.sql"),
    "utf8",
  );
}

describe("Wix integration migrations", () => {
  it("initializes every official stable taxonomy code without destructive deletes", () => {
    const sql = migration("20260810193000_official_taxonomy_bridge");
    const categoryCodes = [
      "land-clearing",
      "surveyors",
      "builders",
      "dirt-work-excavation",
      "fencing-entrances",
      "water-well-septic",
      "forestry-timber",
      "property-maintenance",
      "wildlife-management",
      "farm-agriculture",
      "land-lenders",
      "land-realtors",
    ];
    const landCodes = [
      "development",
      "farmland",
      "timberland",
      "ranching",
      "homestead",
      "hunting",
    ];
    const projectCodes = [
      "culvert-install",
      "barndominium-building",
      "brush-hogging",
      "pond-building",
      "cabin-construction",
      "driveway-construction",
      "water-well-drilling",
      "gated-entrance",
      "drainage-improvement",
      "irrigation-system-installation",
      "retaining-wall-construction",
      "utility-trenching",
      "tree-removal-stump-grinding",
      "land-grading-leveling",
    ];

    for (const code of [...categoryCodes, ...landCodes, ...projectCodes]) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toContain('"archivedAt"');
    expect(sql).toContain('ON CONFLICT ("contractorTypeId", "projectTypeId", "tier") DO NOTHING');
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it("preserves existing settings and adds only missing defaults", () => {
    const sql = migration("20260810190000_seed_required_app_settings");
    expect(sql).toContain("('maxLeadRecipients', '3'");
    expect(sql).toContain("('leadExpiryHours', '48'");
    expect(sql).toContain('ON CONFLICT ("key") DO NOTHING');
  });

  it("adds private attachment metadata without defining a transport", () => {
    const sql = migration("20260810231500_lead_attachment_metadata");
    expect(sql).toContain('CREATE TABLE "LeadAttachment"');
    expect(sql).toContain('"storageProvider"');
    expect(sql).toContain('"storageKey"');
    expect(sql).toContain("ON DELETE RESTRICT");
    expect(sql).not.toMatch(/multipart|base64|signed.?url|wix media/i);
  });
});
