"use client";

import { useLinkStatus } from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

/**
 * The "View & respond" row of a lead card. Rendered inside the card's <Link>, it
 * flips to an "Opening…" spinner the instant the card is tapped (useLinkStatus)
 * so opening a lead never feels frozen while the detail page loads.
 */
export function LeadCardCta({ timeLabel }: { timeLabel: string }) {
  const { pending } = useLinkStatus();
  return (
    <div className="flex items-center justify-between text-sm text-text-muted">
      <span>{timeLabel}</span>
      <span className="flex items-center gap-1 font-medium text-primary">
        {pending ? "Opening…" : "View & respond"}
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden />
        )}
      </span>
    </div>
  );
}
