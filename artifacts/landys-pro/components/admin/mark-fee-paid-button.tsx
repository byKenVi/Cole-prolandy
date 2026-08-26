"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markFeePaidManually } from "@/app/actions/fees";

export function MarkFeePaidButton({ leadMatchId }: { leadMatchId: string }) {
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
        style={{
          height: 36,
          padding: "0 14px",
          background: "var(--gold)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          font: "600 13px/1 'Inter'",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Saving…" : "Mark paid"}
      </button>
      {error && (
        <span style={{ font: "500 11px/1.3 'Inter'", color: "var(--danger)", maxWidth: 140, textAlign: "right" }}>
          {error}
        </span>
      )}
    </div>
  );
}
