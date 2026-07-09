"use client";

import { useLinkStatus } from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

/**
 * The "View lead" button of a lead card. Rendered inside the card's <Link> (so
 * it's a styled span, not a nested anchor), it flips to an "Opening…" spinner
 * the instant the card is tapped (useLinkStatus) so it never feels frozen.
 */
export function LeadCardCta() {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-accent-hover">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening…
        </>
      ) : (
        <>
          View lead
          <ChevronRight className="h-4 w-4" aria-hidden />
        </>
      )}
    </span>
  );
}
