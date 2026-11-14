import { normalizeLiveWorkTypeCode } from "@/lib/taxonomy/live-v3";
import { cleanCountyList, cleanZipList, splitList } from "@/lib/domain/service-area";
import { slugifyTaxonomy } from "@/lib/services/taxonomy-registry";
import { normalizeLiveCategoryCode } from "@/lib/taxonomy/live-v3";
import type { NormalizedContractorSyncRecord } from "@/lib/integrations/contractors/contract";

/**
 * Wix "All Contractors" CMS item → Landy's Pro contractor.
 *
 * The Wix Data API returns field KEYS (e.g. `companyName` or `title`) while
 * the CMS UI and the landys.co PDF show display NAMES ("Company Name"). We do
 * not know which keys the live collection uses, so every lookup goes through
 * `pickField`, which matches keys case- and punctuation-insensitively against
 * a list of aliases. Lists may arrive as arrays or "a, b, c" strings, and
 * booleans as true / "Yes".
 */

/** Wix returns dates as either a plain ISO string or a `{ $date: string }` object. */
export type WixDateValue = string | { $date: string };

export function parseWixDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "$date" in value) {
    const date = (value as { $date: unknown }).$date;
    return typeof date === "string" ? date : undefined;
  }
  return undefined;
}

export type WixAllContractorItem = Record<string, unknown> & { _id: string };

const FIELD_ALIASES = {
  name: ["companyName", "company", "businessName", "title", "name"],
  email: ["email", "emailAddress", "contactEmail", "businessEmail"],
  phone: ["phone", "phoneNumber", "contactPhone", "businessPhone", "mobile"],
  website: ["websiteUrl", "website", "websiteLink", "url"],
  shortDescription: ["shortDescription", "tagline"],
  longDescription: ["longDescription", "description", "about", "aboutUs"],
  status: ["status", "contractorStatus"],
  categories: ["contractorsCategory", "contractorCategory", "contractorsCategories", "categories", "category"],
  secondaryCategories: ["secondaryCategories", "secondaryCategory"],
  projectTypes: ["projectType", "projectTypes", "services"],
  projectSpecialties: ["projectSpecialties", "specialties"],
  landTypes: ["landTypes", "landType"],
  serviceZipCodes: ["serviceZipCodes", "serviceZipCode", "serviceZips", "zipCodes", "zipCode", "serviceAreaZipCodes"],
  serviceCounties: ["serviceCounties", "serviceCounty", "counties", "county", "serviceArea"],
  contractorId: ["contractorId"],
  proPortalId: ["proPortalId"],
  createdDate: ["_createdDate", "createdDate"],
  updatedDate: ["_updatedDate", "updatedDate"],
  verified: ["verified"],
  featured: ["featured"],
  topProBadge: ["topProBadge"],
  badge: ["badge"],
  reviews: ["reviews"],
  googleReviewsUrl: ["googleReviewsUrl"],
  yearsExperience: ["yearsExperience"],
  responseSpeed: ["responseSpeed"],
  budgetTier: ["budgetTier"],
  timelineCapacity: ["timelineCapacity"],
  profilePath: ["allContractorsItem", "link-all-contractors-title", "profileUrl"],
} as const;

type FieldName = keyof typeof FIELD_ALIASES;

function keyOf(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function indexItem(item: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(item)) {
    const k = keyOf(key);
    if (!map.has(k)) map.set(k, value);
  }
  return map;
}

export function pickField(item: Record<string, unknown> | Map<string, unknown>, field: FieldName): unknown {
  const index = item instanceof Map ? item : indexItem(item);
  for (const alias of FIELD_ALIASES[field]) {
    const value = index.get(keyOf(alias));
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["yes", "true", "y", "1", "active"].includes(v)) return true;
    if (["no", "false", "n", "0"].includes(v)) return false;
  }
  return null;
}

/**
 * Active unless the CMS says otherwise. A missing status means the field is
 * not used — treating that as "inactive" would deactivate everyone.
 */
export function normalizeWixContractorStatus(status: unknown): "active" | "inactive" {
  const text = asText(status)?.toLowerCase();
  if (!text) return "active";
  if (["active", "approved", "live", "published", "verified", "yes"].includes(text)) return "active";
  return "inactive";
}

/** Category label → stable code ("Roofing" → roofing, "Land Lenders" → land-lenders). */
export function resolveOfficialCategoryCode(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  return normalizeLiveCategoryCode(trimmed) ?? (slugifyTaxonomy(trimmed) || null);
}

export function resolveOfficialWorkTypeCode(label: string): string | null {
  return normalizeLiveWorkTypeCode(label);
}

export type NormalizedWixContractor = {
  record: NormalizedContractorSyncRecord;
  /** Primary first, then secondary; raw labels as written on landys.co. */
  categoryLabels: string[];
  serviceZipCodes: string[];
  serviceCounties: string[];
  websiteUrl: string | null;
  sourceStatus: string | null;
  isActive: boolean;
  /** Keys present on the raw item (shown in the admin dry-run to verify mapping). */
  rawKeys: string[];
  metadata: Record<string, unknown>;
};

export function normalizeWixContractorRecord(item: WixAllContractorItem): NormalizedWixContractor {
  const index = indexItem(item);
  const get = (field: FieldName) => pickField(index, field);

  const primary = splitList(get("categories"));
  const secondary = splitList(get("secondaryCategories"));
  const categoryLabels = [...new Set([...primary, ...secondary])];
  const firstCategoryCode = categoryLabels.map(resolveOfficialCategoryCode).find(Boolean) ?? undefined;

  const longDescription = asText(get("longDescription"));
  const shortDescription = asText(get("shortDescription"));
  const status = asText(get("status")) ?? null;
  const website = asText(get("website")) ?? null;

  return {
    record: {
      source: "wix",
      externalId: item._id,
      profile: {
        name: asText(get("name")),
        email: asText(get("email"))?.toLowerCase(),
        phone: asText(get("phone")),
        aboutSection: longDescription ?? shortDescription ?? null,
        businessHours: null,
      },
      contractorCategoryCode: firstCategoryCode,
      // Work types are informative on landys.co; matching no longer uses them.
      workTypeCodes: undefined,
      projectTypeCodes: undefined,
    },
    categoryLabels,
    serviceZipCodes: cleanZipList(get("serviceZipCodes")),
    serviceCounties: cleanCountyList(get("serviceCounties")),
    websiteUrl: website && /^https?:\/\//i.test(website) ? website : website ? `https://${website}` : null,
    sourceStatus: status,
    isActive: normalizeWixContractorStatus(status) === "active",
    rawKeys: Object.keys(item).sort(),
    metadata: {
      contractorId: asText(get("contractorId")) ?? null,
      proPortalId: asText(get("proPortalId")) ?? null,
      wixCreatedDate: parseWixDate(get("createdDate")) ?? null,
      wixUpdatedDate: parseWixDate(get("updatedDate")) ?? null,
      secondaryCategories: secondary,
      projectTypes: splitList(get("projectTypes")),
      projectSpecialties: splitList(get("projectSpecialties")),
      landTypes: splitList(get("landTypes")),
      shortDescription: shortDescription ?? null,
      status,
      verified: asBoolean(get("verified")),
      featured: asBoolean(get("featured")),
      topProBadge: asBoolean(get("topProBadge")),
      badge: asText(get("badge")) ?? null,
      reviews: asText(get("reviews")) ?? null,
      googleReviewsUrl: asText(get("googleReviewsUrl")) ?? null,
      yearsExperience: asText(get("yearsExperience")) ?? null,
      responseSpeed: asText(get("responseSpeed")) ?? null,
      budgetTier: asText(get("budgetTier")) ?? null,
      timelineCapacity: asText(get("timelineCapacity")) ?? null,
      profilePath: asText(get("profilePath")) ?? null,
    },
  };
}
