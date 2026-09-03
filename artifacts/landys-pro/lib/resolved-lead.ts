export function hasResolvedLeadSnapshot<
  T extends {
    expiresAt: Date | null;
  },
>(lead: T): lead is T & { expiresAt: Date } {
  // V2 opportunities are free to review and intentionally have no legacy
  // pay-per-lead tier or price. Expiration is the only required delivery
  // snapshot; labels resolve from the live work/category taxonomy below.
  return lead.expiresAt !== null;
}

export function leadScopeLabel(lead: {
  projectType?: { name: string } | null;
  workType?: { name: string } | null;
}): string {
  return lead.workType?.name ?? lead.projectType?.name ?? "Project";
}

export function leadCategoryLabel(lead: {
  projectType?: { contractorType?: { name: string } | null } | null;
  contractorCategory?: { name: string } | null;
}): string {
  return lead.contractorCategory?.name ?? lead.projectType?.contractorType?.name ?? "General";
}

export function leadCategoryIcon(lead: {
  projectType?: { contractorType?: { icon?: string | null } | null } | null;
}): string | null {
  return lead.projectType?.contractorType?.icon ?? null;
}

export const leadDisplayInclude = {
  projectType: { include: { contractorType: true } },
  workType: true,
  contractorCategory: true,
  landType: true,
} as const;
