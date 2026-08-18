import {
  normalizeLiveCategoryCode,
  normalizeLiveWorkTypeCode,
} from "@/lib/taxonomy/live-v3";
import type { NormalizedContractorSyncRecord } from "@/lib/integrations/contractors/contract";

/** Wix returns dates as either a plain ISO string or a `{ $date: string }` object. */
export type WixDateValue = string | { $date: string };

/** Extract an ISO date string from whatever format Wix uses for date fields. */
export function parseWixDate(value: WixDateValue | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.$date;
}

export type WixAllContractorItem = {
  _id: string;
  contractorId?: string;
  proPortalId?: string;
  _createdDate?: WixDateValue;
  _updatedDate?: WixDateValue;
  companyName?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  shortDescription?: string;
  longDescription?: string;
  logo?: unknown;
  heroImage?: unknown;
  gallery?: unknown;
  status?: string;
  verified?: boolean;
  badge?: string;
  topProBadge?: boolean;
  featured?: boolean;
  contractorsCategory?: string[];
  secondaryCategories?: string[];
  projectType?: string[];
  projectSpecialties?: string[];
  landTypes?: string[];
  yearsExperience?: number;
  budgetTier?: string;
  timelineCapacity?: string;
  responseSpeed?: string;
  serviceZipCodes?: string[];
  serviceCounties?: string[];
  reviews?: unknown;
  googleReviewsUrl?: string;
};

const LEGACY_CATEGORIES = new Map<string, string>([
  ["land clearing", "land-clearing"],
  ["surveyors", "surveyors"],
  ["builders", "builders"],
  ["dirt work & excavation", "dirt-work-excavation"],
  ["fencing & entrances", "fencing-entrances"],
  ["water well & septic", "water-well-septic"],
  ["forestry & timber", "forestry-timber"],
  ["property maintenance", "property-maintenance"],
  ["wildlife management", "wildlife-management"],
  ["farm & agriculture", "farm-agriculture"],
  ["land lenders", "land-lenders"],
  ["land realtors", "land-realtors"],
]);

const LEGACY_PROJECT_TYPES = new Map<string, string>([
  ["culvert install", "culvert-install"],
  ["barndominium building", "barndominium-building"],
  ["brush hogging", "brush-hogging"],
  ["pond building", "pond-building"],
  ["cabin construction", "cabin-construction"],
  ["driveway construction", "driveway-construction"],
  ["water well drilling", "water-well-drilling"],
  ["gated entrance", "gated-entrance"],
  ["drainage improvement", "drainage-improvement"],
  ["irrigation system installation", "irrigation-system-installation"],
  ["retaining wall construction", "retaining-wall-construction"],
  ["utility trenching", "utility-trenching"],
  ["tree removal & stump grinding", "tree-removal-stump-grinding"],
  ["land grading & leveling", "land-grading-leveling"],
]);

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveOfficialCategoryCode(label: string): string | null {
  return (
    normalizeLiveCategoryCode(label) ??
    LEGACY_CATEGORIES.get(normalizeLabel(label)) ??
    null
  );
}

export function resolveOfficialProjectTypeCode(label: string): string | null {
  return LEGACY_PROJECT_TYPES.get(normalizeLabel(label)) ?? null;
}

export function resolveOfficialWorkTypeCode(label: string): string | null {
  return normalizeLiveWorkTypeCode(label);
}

export function normalizeWixContractorStatus(status: string | undefined): "active" | "inactive" {
  if (!status?.trim()) return "inactive";
  return normalizeLabel(status) === "active" ? "active" : "inactive";
}

export function normalizeWixContractorRecord(item: WixAllContractorItem): {
  record: NormalizedContractorSyncRecord;
  unresolvedCategories: string[];
  unresolvedProjectTypes: string[];
  unresolvedWorkTypes: string[];
  unresolvedLandTypes: string[];
  sourceStatus: string | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
} {
  const unresolvedCategories: string[] = [];
  const categoryCodes = (item.contractorsCategory ?? [])
    .map((label) => {
      const code = resolveOfficialCategoryCode(label);
      if (!code) unresolvedCategories.push(label);
      return code;
    })
    .filter((code): code is string => Boolean(code));

  const unresolvedProjectTypes: string[] = [];
  const inputProjectTypes = item.projectType ?? [];
  const resolvedWorkCodes = inputProjectTypes
    .map((label) => {
      const code = resolveOfficialWorkTypeCode(label);
      if (!code) unresolvedProjectTypes.push(label);
      return code;
    })
    .filter((code): code is string => Boolean(code));

  const workTypeCodes: string[] | undefined =
    inputProjectTypes.length > 0 && resolvedWorkCodes.length === 0
      ? undefined
      : [...new Set(resolvedWorkCodes)];

  const unresolvedLandTypes = (item.landTypes ?? []).map((v) => v.trim()).filter(Boolean);
  const sourceStatus = item.status?.trim() ?? null;
  const isActive = normalizeWixContractorStatus(item.status) === "active";

  return {
    record: {
      source: "wix",
      externalId: item._id,
      profile: {
        name: item.companyName?.trim(),
        email: item.email?.trim().toLowerCase(),
        phone: item.phone?.trim(),
        aboutSection: item.longDescription ?? item.shortDescription ?? null,
        businessHours: null,
      },
      contractorCategoryCode: categoryCodes[0],
      workTypeCodes,
      projectTypeCodes: [],
    },
    unresolvedCategories,
    unresolvedProjectTypes,
    unresolvedWorkTypes: unresolvedProjectTypes,
    unresolvedLandTypes,
    sourceStatus,
    isActive,
    metadata: {
      contractorId: item.contractorId ?? null,
      proPortalId: item.proPortalId ?? null,
      wixCreatedDate: parseWixDate(item._createdDate) ?? null,
      wixUpdatedDate: parseWixDate(item._updatedDate) ?? null,
      secondaryCategories: item.secondaryCategories ?? [],
      landTypes: item.landTypes ?? [],
      websiteUrl: item.websiteUrl ?? null,
      shortDescription: item.shortDescription ?? null,
      status: sourceStatus,
      verified: item.verified ?? null,
      featured: item.featured ?? null,
      serviceZipCodes: item.serviceZipCodes ?? [],
      serviceCounties: item.serviceCounties ?? [],
      raw: item,
    },
  };
}
