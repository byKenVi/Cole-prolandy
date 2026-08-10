"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizeLeadReview } from "@/app/actions/admin";

export function LeadReviewForm({
  leadId,
  currentTier,
  contractorReviewRequired,
}: {
  leadId: string;
  currentTier: number | null;
  contractorReviewRequired: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tier, setTier] = useState(currentTier ? String(currentTier) : "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/5 p-4">
      <div>
        <p className="font-inter text-sm font-semibold text-text">Intake review required</p>
        <p className="mt-1 font-inter text-xs text-text-muted">
          Choose the approved price tier. The current matrix price is snapshotted once before
          routing.
          {contractorReviewRequired
            ? " This direct request will remain held until its external contractor identity resolves."
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 font-inter text-xs font-medium text-text-muted">
          Approved tier
          <select
            value={tier}
            onChange={(event) => setTier(event.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3 font-inter text-sm text-text"
          >
            <option value="">Choose tier</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !tier}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await finalizeLeadReview(leadId, Number(tier));
              setError(!result.ok);
              setMessage(result.message ?? (result.ok ? "Lead reviewed." : "Review failed."));
              if (result.ok) router.refresh();
            });
          }}
          className="h-11 rounded-md bg-accent px-4 font-inter text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {pending ? "Finalizing…" : "Snapshot price and route"}
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
