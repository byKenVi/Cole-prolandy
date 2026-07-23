"use client";

import { useTransition } from "react";
import { viewAsContractor } from "@/app/actions/dev";

/** Compact admin "View as contractor" control. */
export function ViewAsButton({ contractorId }: { contractorId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="a-ghostbtn"
      disabled={pending}
      onClick={() => startTransition(() => viewAsContractor(contractorId))}
      title="View as this contractor"
      style={{
        height: 34,
        padding: "0 12px",
        background: "var(--field)",
        border: "1px solid var(--fieldLine)",
        borderRadius: 9,
        font: "600 12px/1 'Inter'",
        color: "var(--ink)",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.7 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {pending ? "…" : "View as"}
    </button>
  );
}
