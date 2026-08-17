"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizeLeadReview } from "@/app/actions/admin";
import { centsToDollars, dollarsToCents } from "@/lib/money";

export function LeadReviewForm({
  leadId,
  currentBudgetCents,
  budgetRaw,
  contractorReviewRequired,
}: {
  leadId: string;
  currentBudgetCents: number | null;
  budgetRaw: string | null;
  contractorReviewRequired: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [budget, setBudget] = useState(
    currentBudgetCents != null
      ? String(centsToDollars(currentBudgetCents))
      : budgetRaw?.replace(/[^\d.]/g, "") ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/5 p-4">
      <div>
        <p className="font-inter text-sm font-semibold text-text">Budget review required</p>
        <p className="mt-1 font-inter text-xs text-text-muted">
          Correct the project budget. Tier and lead price are calculated automatically from the
          pricing matrix thresholds.
          {budgetRaw ? ` Raw Wix value: ${budgetRaw}` : ""}
          {contractorReviewRequired
            ? " This direct request will remain held until its external contractor identity resolves."
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 font-inter text-xs font-medium text-text-muted">
          Project budget (USD)
          <input
            value={budget}
            onChange={(event) => setBudget(event.target.value.replace(/[^0-9.]/g, ""))}
            className="h-11 rounded-md border border-border bg-surface px-3 font-inter text-sm text-text"
            placeholder="10000"
          />
        </label>
        <button
          type="button"
          disabled={pending || !budget}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await finalizeLeadReview(leadId, dollarsToCents(budget));
              setError(!result.ok);
              setMessage(result.message ?? (result.ok ? "Lead reviewed." : "Review failed."));
              if (result.ok) router.refresh();
            });
          }}
          className="h-11 rounded-md bg-accent px-4 font-inter text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {pending ? "Finalizing…" : "Resolve budget and route"}
        </button>
      </div>
      {message && (
        <p className={`font-inter text-xs ${error ? "text-danger" : "text-success"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
