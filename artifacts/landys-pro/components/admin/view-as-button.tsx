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
        minHeight: 44,
        padding: "0 14px",
        background: "var(--field)",
        border: "1px solid var(--fieldLine)",
        borderRadius: 10,
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
