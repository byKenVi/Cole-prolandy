"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignLeadAction, retryLeadRoutingAction } from "@/app/actions/admin";

const REASONS: Record<string, string> = {
  NO_ELIGIBLE_CONTRACTORS: "No active contractor in this category covers the property's area.",
  DIRECT_CONTRACTOR_NOT_FOUND:
    "The homeowner asked for a specific contractor who is not in Landy's Pro (or is deactivated). Sync contractors from landys.co, then try again, or pick a contractor below.",
  MISSING_CONTRACTOR_CATEGORY: "The request has no contractor category.",
  OTHER_CATEGORY_CLASSIFICATION_REQUIRED: "The request is in the \"Other\" category and no contractor covers it.",
  ROUTING_ERROR: "Automatic routing failed. Try again, or pick contractors by hand.",
};

export type ContractorOption = { id: string; name: string; detail: string; sameCategory: boolean };

/** Shown on a lead that was not sent to anyone: explain why and fix it in one place. */
export function HeldLeadPanel({
  leadId,
  reason,
  contractors,
}: {
  leadId: string;
  reason: string | null;
  contractors: ContractorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? contractors : contractors.filter((c) => c.sameCategory);

  function retry() {
    setMessage(null);
    startTransition(async () => {
      const res = await retryLeadRoutingAction(leadId);
      setMessage({ ok: res.ok, text: res.message ?? "" });
      router.refresh();
    });
  }

  function assign() {
    setMessage(null);
    startTransition(async () => {
      const res = await assignLeadAction(leadId, picked);
      setMessage({ ok: res.ok, text: res.message ?? "" });
      if (res.ok) {
        setPicked([]);
        router.refresh();
      }
    });
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderLeft: "4px solid var(--goldStrong)",
        borderRadius: 14,
        background: "var(--card)",
        padding: 18,
        marginBottom: 20,
      }}
    >
      <p style={{ margin: 0, font: "600 16px/1.3 Rubik, sans-serif", color: "var(--ink)" }}>
        Not sent to any contractor yet
      </p>
      <p style={{ margin: "6px 0 14px", font: "400 14px/1.5 'Inter'", color: "var(--ink2)" }}>
        {(reason && REASONS[reason]) ?? "This request is waiting for review."}
      </p>
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        style={{ height: 42, padding: "0 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", font: "600 14px/1 Rubik, sans-serif", color: "var(--ink)" }}
      >
        {pending ? "Working..." : "Try automatic routing again"}
      </button>

      <div style={{ marginTop: 18 }}>
        <p style={{ margin: "0 0 8px", font: "600 14px/1.3 Rubik, sans-serif", color: "var(--ink)" }}>
          Or send it to contractors you choose
        </p>
        <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
          {visible.length === 0 && (
            <p style={{ margin: 0, padding: 12, font: "400 13px/1.4 'Inter'", color: "var(--ink2)" }}>
              No contractor in this category.
            </p>
          )}
          {visible.map((c) => (
            <label
              key={c.id}
              style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderBottom: "1px solid var(--line)", font: "400 14px/1.4 'Inter'", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={picked.includes(c.id)}
                onChange={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>{c.name}</strong>
                <span style={{ display: "block", color: "var(--ink2)", fontSize: 12 }}>{c.detail}</span>
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={assign}
            disabled={pending || picked.length === 0}
            style={{ height: 42, padding: "0 16px", borderRadius: 10, border: 0, background: "var(--gold)", color: "#fff", font: "600 14px/1 Rubik, sans-serif", opacity: pending || picked.length === 0 ? 0.6 : 1 }}
          >
            Send to {picked.length || ""} selected
          </button>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            style={{ border: 0, background: "transparent", color: "var(--ink2)", textDecoration: "underline", font: "500 13px/1 Rubik, sans-serif" }}
          >
            {showAll ? "Show only this category" : "Show all contractors"}
          </button>
        </div>
      </div>
      {message && (
        <p role="status" style={{ margin: "12px 0 0", font: "500 14px/1.4 Rubik, sans-serif", color: message.ok ? "var(--pos)" : "var(--danger)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
