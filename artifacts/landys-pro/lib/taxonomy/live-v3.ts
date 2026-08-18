import type { BudgetBand } from "@prisma/client";

export const LIVE_V3_CATEGORY_CODES = [
  "general-contractor",
  "roofing",
  "plumbing",
  "electrical",
  "hvac",
  "landscaping",
  "flooring",
  "painting",
  "kitchen-bath",
  "foundation-concrete",
  "other",
] as const;

export const LIVE_V3_WORK_TYPE_CODES = [
  "new-build",
  "renovation-remodel",
  "repair",
  "addition",
  "installation",
  "maintenance",
  "inspection",
] as const;

export const LIVE_V3_LAND_TYPE_CODES = [
  "residential",
  "commercial",
  "multi-family",
  "rural-land",
] as const;

export const LIVE_V3_TIMELINE_CODES = [
  "asap",
  "within-2-weeks",
  "within-1-month",
  "1-3-months",
  "3-plus-months",
  "just-researching",
] as const;

export const LIVE_V3_URGENCY_CODES = ["emergency", "high", "medium", "low"] as const;

export const LIVE_V3_BUDGET_BANDS: BudgetBand[] = [
  "UNDER_5K",
  "BETWEEN_5K_15K",
  "BETWEEN_15K_50K",
  "OVER_50K",
];

export const REVIEW_BLOCKERS = {
  BUDGET_RESOLUTION_REQUIRED: "BUDGET_RESOLUTION_REQUIRED",
  PRICING_REQUIRED: "PRICING_REQUIRED",
  OTHER_CATEGORY_CLASSIFICATION_REQUIRED: "OTHER_CATEGORY_CLASSIFICATION_REQUIRED",
  MISSING_CONTRACTOR_CATEGORY: "MISSING_CONTRACTOR_CATEGORY",
} as const;

type TaxonomyEntry = { code: string; labels: readonly string[] };

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildLookup(entries: readonly TaxonomyEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(normalizeLabel(entry.code), entry.code);
    for (const label of entry.labels) {
      map.set(normalizeLabel(label), entry.code);
    }
  }
  return map;
}

const CATEGORY_ENTRIES: TaxonomyEntry[] = [
  { code: "general-contractor", labels: ["General Contractor"] },
  { code: "roofing", labels: ["Roofing"] },
  { code: "plumbing", labels: ["Plumbing"] },
  { code: "electrical", labels: ["Electrical"] },
  { code: "hvac", labels: ["HVAC"] },
  { code: "landscaping", labels: ["Landscaping"] },
  { code: "flooring", labels: ["Flooring"] },
  { code: "painting", labels: ["Painting"] },
  { code: "kitchen-bath", labels: ["Kitchen & Bath", "Kitchen and Bath"] },
  { code: "foundation-concrete", labels: ["Foundation & Concrete", "Foundation and Concrete"] },
  { code: "other", labels: ["Other"] },
];

const WORK_TYPE_ENTRIES: TaxonomyEntry[] = [
  { code: "new-build", labels: ["New Build"] },
  { code: "renovation-remodel", labels: ["Renovation / Remodel", "Renovation/Remodel"] },
  { code: "repair", labels: ["Repair"] },
  { code: "addition", labels: ["Addition"] },
  { code: "installation", labels: ["Installation"] },
  { code: "maintenance", labels: ["Maintenance"] },
  { code: "inspection", labels: ["Inspection"] },
];

const LAND_TYPE_ENTRIES: TaxonomyEntry[] = [
  { code: "residential", labels: ["Residential"] },
  { code: "commercial", labels: ["Commercial"] },
  { code: "multi-family", labels: ["Multi-family", "Multi family", "Multifamily"] },
  { code: "rural-land", labels: ["Rural / Land", "Rural/Land", "Rural", "Land"] },
];

const TIMELINE_ENTRIES: TaxonomyEntry[] = [
  { code: "asap", labels: ["ASAP"] },
  { code: "within-2-weeks", labels: ["Within 2 weeks", "Within two weeks"] },
  { code: "within-1-month", labels: ["Within 1 month", "Within one month", "Within 30 days"] },
  { code: "1-3-months", labels: ["1-3 months", "1–3 months"] },
  { code: "3-plus-months", labels: ["3+ months", "3 plus months"] },
  { code: "just-researching", labels: ["Just researching"] },
];

const URGENCY_ENTRIES: TaxonomyEntry[] = [
  { code: "emergency", labels: ["Emergency"] },
  { code: "high", labels: ["High"] },
  { code: "medium", labels: ["Medium"] },
  { code: "low", labels: ["Low"] },
];

const BUDGET_BAND_ENTRIES: Array<{ band: BudgetBand; labels: readonly string[] }> = [
  { band: "UNDER_5K", labels: ["Under $5K", "Under $5,000", "Under 5k", "Under 5000"] },
  {
    band: "BETWEEN_5K_15K",
    labels: ["$5–15K", "$5-15K", "$5,000–$15,000", "$5,000-$15,000", "$5K–$15K"],
  },
  {
    band: "BETWEEN_15K_50K",
    labels: ["$15–50K", "$15-50K", "$15,000–$50,000", "$15,000-$50,000", "$15K–$50K"],
  },
  { band: "OVER_50K", labels: ["$50K+", "$50,000+", "Over $50K", "Over $50,000", "50k+"] },
];

const CATEGORY_LOOKUP = buildLookup(CATEGORY_ENTRIES);
const WORK_TYPE_LOOKUP = buildLookup(WORK_TYPE_ENTRIES);
const LAND_TYPE_LOOKUP = buildLookup(LAND_TYPE_ENTRIES);
const TIMELINE_LOOKUP = buildLookup(TIMELINE_ENTRIES);
const URGENCY_LOOKUP = buildLookup(URGENCY_ENTRIES);

const BUDGET_BAND_LOOKUP = new Map<string, BudgetBand>();
for (const entry of BUDGET_BAND_ENTRIES) {
  BUDGET_BAND_LOOKUP.set(normalizeLabel(entry.band), entry.band);
  for (const label of entry.labels) {
    BUDGET_BAND_LOOKUP.set(normalizeLabel(label), entry.band);
  }
}

export function normalizeLiveCategoryCode(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  return CATEGORY_LOOKUP.get(normalizeLabel(input)) ?? null;
}

export function normalizeLiveWorkTypeCode(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  return WORK_TYPE_LOOKUP.get(normalizeLabel(input)) ?? null;
}

export function normalizeLiveLandTypeCode(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  return LAND_TYPE_LOOKUP.get(normalizeLabel(input)) ?? null;
}

export function normalizeLiveTimelineCode(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  return TIMELINE_LOOKUP.get(normalizeLabel(input)) ?? null;
}

export function normalizeLiveUrgencyCode(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  return URGENCY_LOOKUP.get(normalizeLabel(input)) ?? null;
}

export function normalizeLiveBudgetBand(input: string | null | undefined): BudgetBand | null {
  if (!input?.trim()) return null;
  return BUDGET_BAND_LOOKUP.get(normalizeLabel(input)) ?? null;
}

export function isLiveV3CategoryCode(code: string): boolean {
  return (LIVE_V3_CATEGORY_CODES as readonly string[]).includes(code);
}

export function isOtherCategoryCode(code: string | null | undefined): boolean {
  return code === "other";
}
