import type { BudgetBand } from "@prisma/client";
import {
  normalizeLiveBudgetBand,
  normalizeLiveCategoryCode,
  normalizeLiveLandTypeCode,
  normalizeLiveTimelineCode,
  normalizeLiveUrgencyCode,
  normalizeLiveWorkTypeCode,
  REVIEW_BLOCKERS,
} from "@/lib/taxonomy/live-v3";

export type ResolvedLiveTaxonomies = {
  intakeMode: "live" | "legacy";
  categoryCode: string | null;
  workTypeCode: string | null;
  legacyProjectTypeCode: string | null;
  landTypeCode: string | null;
  timelineCode: string | null;
  timelineRaw: string;
  timelineDate: Date | null;
  urgencyCode: string | null;
  urgencyRaw: string;
  budgetBand: BudgetBand | null;
};

export function resolveTimelineInput(timeline: string): {
  code: string | null;
  raw: string;
  date: Date | null;
} {
  const raw = timeline.trim();
  const code = normalizeLiveTimelineCode(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { code: code ?? raw, raw, date: new Date(`${raw}T00:00:00.000Z`) };
  }
  return { code, raw, date: null };
}

export function resolveTaxonomyInputs(input: {
  contractorCategoryCode?: string | null;
  landTypeCode: string;
  projectTypeCode: string;
  timeline: string;
  urgency: string;
  budget?: string | null;
  budgetBand?: string | null;
}): ResolvedLiveTaxonomies {
  const timeline = resolveTimelineInput(input.timeline);
  const urgencyRaw = input.urgency.trim();
  const workTypeCode = normalizeLiveWorkTypeCode(input.projectTypeCode);
  const legacyProjectTypeCode = workTypeCode ? null : input.projectTypeCode.trim().toLowerCase();

  return {
    intakeMode: workTypeCode ? "live" : "legacy",
    categoryCode: normalizeLiveCategoryCode(input.contractorCategoryCode),
    workTypeCode,
    legacyProjectTypeCode,
    landTypeCode:
      normalizeLiveLandTypeCode(input.landTypeCode) ??
      input.landTypeCode.trim().toLowerCase(),
    timelineCode: timeline.code,
    timelineRaw: timeline.raw,
    timelineDate: timeline.date,
    urgencyCode: normalizeLiveUrgencyCode(urgencyRaw),
    urgencyRaw,
    budgetBand:
      normalizeLiveBudgetBand(input.budgetBand) ??
      normalizeLiveBudgetBand(input.budget),
  };
}

export { REVIEW_BLOCKERS };
