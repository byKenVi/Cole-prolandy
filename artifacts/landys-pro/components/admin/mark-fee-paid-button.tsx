"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markFeePaidManually } from "@/app/actions/fees";

export function MarkFeePaidButton({
  leadMatchId,
  prominent = false,
}: {
  leadMatchId: string;
  prominent?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await markFeePaidManually(leadMatchId);
      if (res.ok) router.refresh();
      else setError(res.message ?? "Could not mark as paid.");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="a-gold"
        title="Record a manual or check payment received outside Stripe"
        style={{
          height: prominent ? 42 : 36,
          padding: prominent ? "0 16px" : "0 14px",
          background: "var(--gold)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          font: prominent ? "600 13px/1.2 'Inter'" : "600 13px/1 'Inter'",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
          boxShadow: prominent ? "0 6px 14px rgba(192,128,60,.28)" : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {pending ? "Saving…" : prominent ? "Mark paid · Manual / Check" : "Mark paid"}
      </button>
      {error && (
        <span style={{ font: "500 11px/1.3 'Inter'", color: "var(--danger)", maxWidth: 180, textAlign: "right" }}>
          {error}
        </span>
      )}
    </div>
  );
}
