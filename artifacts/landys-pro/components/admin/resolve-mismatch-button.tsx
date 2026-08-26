"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveMismatchAction } from "@/app/actions/admin";

export function ResolveMismatchButton({ confirmationId }: { confirmationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onResolve() {
    setError(null);
    startTransition(async () => {
      const res = await resolveMismatchAction(confirmationId, note.trim() || undefined);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message ?? "Could not resolve.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          height: 34,
          padding: "0 12px",
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: "var(--card2)",
          font: "600 12px/1 'Inter'",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        Mark reviewed
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <input
        type="text"
        placeholder="Optional note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{
          width: 180,
          height: 32,
          padding: "0 10px",
          borderRadius: 8,
          border: "1px solid var(--fieldLine)",
          font: "400 12px/1 'Inter'",
        }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={pending}
          onClick={onResolve}
          className="a-gold"
          style={{
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: "none",
            background: "var(--gold)",
            color: "#fff",
            font: "600 12px/1 'Inter'",
            cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "transparent",
            font: "500 12px/1 'Inter'",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <span style={{ font: "500 11px/1.3 'Inter'", color: "var(--danger)" }}>{error}</span>
      )}
    </div>
  );
}
