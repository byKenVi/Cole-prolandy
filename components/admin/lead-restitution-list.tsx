"use client";

import { RefundButton } from "@/components/admin/refund-button";
import { formatMoney } from "@/lib/money";

export type RestitutionLead = {
  matchId: string;
  projectName: string;
  location: string;
  priceCents: number;
  alreadyRefunded: boolean;
};

/**
 * Admin can restore wallet funds for an accepted lead that was charged in error.
 * Only these lead-linked restitutions — no free-form promo / deduct / ambiguous refunds.
 */
export function LeadRestitutionList({ leads }: { leads: RestitutionLead[] }) {
  const eligible = leads.filter((l) => !l.alreadyRefunded);

  if (leads.length === 0) {
    return <p className="text-sm text-text-muted">No accepted leads yet.</p>;
  }

  if (eligible.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        All accepted lead charges on this contractor have already been restored.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-sm bg-primary-soft p-3 text-sm text-text-muted">
        Restore the amount charged for a bad or disputed lead back to the contractor&apos;s{" "}
        <strong className="text-text">wallet</strong>. Each lead can only be restored once.
      </p>
      <ul className="divide-y divide-border rounded-sm border border-border">
        {eligible.map((l) => (
          <li key={l.matchId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-text">{l.projectName}</p>
              <p className="truncate text-xs text-text-muted">{l.location}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums text-sm font-semibold text-text">
                {formatMoney(l.priceCents)}
              </span>
              <RefundButton leadMatchId={l.matchId} label="Refund" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
