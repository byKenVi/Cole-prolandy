import type { BudgetBand } from "@prisma/client";
import { lookupZip } from "@/lib/geo/zip";
import { formatMoney } from "@/lib/money";
import {
  BUDGET_BAND_LABELS,
  LIVE_V3_TIMELINE_NAMES,
  LIVE_V3_URGENCY_NAMES,
  normalizeLiveBudgetBand,
  normalizeLiveTimelineCode,
  normalizeLiveUrgencyCode,
} from "@/lib/taxonomy/live-v3";
import type { SuccessFeeTierRow } from "@/lib/domain/success-fee";

/**
 * One place that turns a stored lead into the words contractors and
 * landowners read (SMS, email and pages all use this, so they never disagree).
 */

export type LeadForSummary = {
  propertyZip?: string | null;
  propertyLocation: string;
  description?: string | null;
  budget?: string | null;
  budgetCents?: number | null;
  budgetBand?: BudgetBand | null;
  timeline?: Date | null;
  timelineCode?: string | null;
  timelineRaw?: string | null;
  urgency?: string | null;
  urgencyCode?: string | null;
  landownerName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  contractorCategory?: { name: string } | null;
  workType?: { name: string } | null;
  projectType?: { name: string; contractorType?: { name: string } | null } | null;
  landType?: { name: string } | null;
};

export type LeadSummary = {
  categoryName: string;
  workTypeName: string | null;
  /** "Roofing - New Build" */
  title: string;
  /** "Hemphill, TX" (null when the ZIP is unknown) */
  cityState: string | null;
  /** "Hemphill, TX 75948" or the raw location */
  place: string;
  zip: string | null;
  budgetLabel: string | null;
  timelineLabel: string | null;
  urgencyLabel: string | null;
  landTypeName: string | null;
  description: string | null;
  landownerName: string;
  landownerFirstName: string;
};

const BAND_BOUNDS: Record<BudgetBand, { min: number; max: number }> = {
  UNDER_5K: { min: 1, max: 499_999 },
  BETWEEN_5K_15K: { min: 500_000, max: 1_500_000 },
  BETWEEN_15K_50K: { min: 1_500_001, max: 5_000_000 },
  OVER_50K: { min: 5_000_001, max: 1_000_000_000 },
};

export function budgetLabelFor(lead: Pick<LeadForSummary, "budget" | "budgetCents" | "budgetBand">): string | null {
  if (lead.budgetCents && lead.budgetCents > 0) return formatMoney(lead.budgetCents).replace(/\.00$/, "");
  const band = lead.budgetBand ?? normalizeLiveBudgetBand(lead.budget);
  if (band) return BUDGET_BAND_LABELS[band];
  const raw = lead.budget?.trim();
  return raw ? raw : null;
}

export function timelineLabelFor(lead: Pick<LeadForSummary, "timeline" | "timelineCode" | "timelineRaw">): string | null {
  const code = lead.timelineCode ?? normalizeLiveTimelineCode(lead.timelineRaw);
  if (code && LIVE_V3_TIMELINE_NAMES.has(code)) return LIVE_V3_TIMELINE_NAMES.get(code)!;
  if (lead.timeline) {
    return `By ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(lead.timeline)}`;
  }
  const raw = lead.timelineRaw?.trim();
  return raw ? raw : null;
}

export function urgencyLabelFor(lead: Pick<LeadForSummary, "urgency" | "urgencyCode">): string | null {
  const code = lead.urgencyCode ?? normalizeLiveUrgencyCode(lead.urgency);
  if (code && LIVE_V3_URGENCY_NAMES.has(code)) return LIVE_V3_URGENCY_NAMES.get(code)!;
  const raw = lead.urgency?.trim();
  return raw ? raw : null;
}

export function landownerDisplayName(lead: Pick<LeadForSummary, "landownerName" | "firstName" | "lastName">): string {
  return (
    lead.landownerName?.trim() ||
    [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
    "the homeowner"
  );
}

export async function buildLeadSummary(lead: LeadForSummary): Promise<LeadSummary> {
  const zipSource = lead.propertyZip ?? lead.propertyLocation;
  const info = await lookupZip(zipSource);
  const categoryName =
    lead.contractorCategory?.name ?? lead.projectType?.contractorType?.name ?? "General";
  const workTypeName = lead.workType?.name ?? lead.projectType?.name ?? null;
  const title = workTypeName && workTypeName !== categoryName ? `${categoryName}, ${workTypeName.toLowerCase()}` : categoryName;
  const cityState = info ? `${info.city}, ${info.state}` : null;
  const name = landownerDisplayName(lead);
  return {
    categoryName,
    workTypeName,
    title,
    cityState,
    place: info ? `${info.city}, ${info.state} ${info.zip}` : lead.propertyLocation,
    zip: info?.zip ?? null,
    budgetLabel: budgetLabelFor(lead),
    timelineLabel: timelineLabelFor(lead),
    urgencyLabel: urgencyLabelFor(lead),
    landTypeName: lead.landType?.name ?? null,
    description: lead.description?.trim() || null,
    landownerName: name,
    landownerFirstName: lead.firstName?.trim() || name.split(/\s+/)[0] || name,
  };
}

/** "5%" or "3-4%" — the success-fee rate(s) a lead's budget falls into. */
export function feeRateLabelFor(
  tiers: SuccessFeeTierRow[],
  lead: Pick<LeadForSummary, "budget" | "budgetCents" | "budgetBand">,
): string | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  const rateAt = (cents: number) => {
    for (const tier of sorted) {
      if (tier.maxValueCents === null || cents <= tier.maxValueCents) return tier.rateBasisPoints;
    }
    return sorted[sorted.length - 1].rateBasisPoints;
  };
  const pct = (bps: number) => {
    const value = bps / 100;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };
  let rates: number[];
  if (lead.budgetCents && lead.budgetCents > 0) {
    rates = [rateAt(lead.budgetCents)];
  } else {
    const band = lead.budgetBand ?? normalizeLiveBudgetBand(lead.budget);
    if (!band) {
      rates = sorted.map((t) => t.rateBasisPoints);
    } else {
      const bounds = BAND_BOUNDS[band];
      rates = [rateAt(bounds.min), rateAt(bounds.max)];
    }
  }
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return min === max ? `${pct(min)}%` : `${pct(min)}% to ${pct(max)}%`;
}
