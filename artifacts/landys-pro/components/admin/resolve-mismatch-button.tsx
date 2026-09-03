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
          height: 38,
          padding: "0 14px",
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: "var(--card)",
          font: "600 13px/1 'Inter'",
          color: "var(--ink)",
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(58,53,45,.08)",
        }}
      >
        Mark reviewed
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "stretch",
        minWidth: 220,
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--line)",
        background: "var(--card2)",
      }}
    >
      <p style={{ margin: 0, font: "500 12px/1.35 'Inter'", color: "var(--ink3)" }}>
        Clears the mismatch flag. Optional note for your records.
      </p>
      <input
        type="text"
        placeholder="Optional note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{
          width: "100%",
          height: 36,
          padding: "0 10px",
          borderRadius: 8,
          border: "1px solid var(--fieldLine)",
          background: "var(--field)",
          font: "400 13px/1 'Inter'",
          color: "var(--ink)",
        }}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "transparent",
            font: "500 12px/1 'Inter'",
            color: "var(--ink2)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onResolve}
          className="a-gold"
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 8,
            border: "none",
            background: "var(--gold)",
            color: "#fff",
            font: "600 12px/1 'Inter'",
            cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Saving…" : "Done"}
        </button>
      </div>
      {error && (
        <span style={{ font: "500 11px/1.3 'Inter'", color: "var(--danger)" }}>{error}</span>
      )}
    </div>
  );
}
