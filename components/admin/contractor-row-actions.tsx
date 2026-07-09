"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { viewAsContractor } from "@/app/actions/dev";
import { deleteContractor } from "@/app/actions/admin";

/**
 * The per-row "View as" + delete controls for the contractors list, styled to
 * the design model (field pill + danger icon button). Wired to the real server
 * actions: viewAsContractor (impersonation) and the integrity-guarded
 * deleteContractor. Sits above the row's stretched link (z-index).
 */
export function ContractorRowActions({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [pendingView, startView] = useTransition();
  const [pendingDel, startDel] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function del() {
    setError(null);
    startDel(async () => {
      const res = await deleteContractor(contractorId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message ?? "Could not delete.");
        setArmed(false);
      }
    });
  }

  return (
    <div
      style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", gap: 14 }}
    >
      {error && (
        <span style={{ maxWidth: 220, font: "500 11px/1.3 'Inter'", color: "var(--danger)" }}>
          {error}
        </span>
      )}
      <button
        type="button"
        className="a-ghostbtn"
        disabled={pendingView}
        onClick={() => startView(() => viewAsContractor(contractorId))}
        style={{
          height: 38,
          padding: "0 15px",
          background: "var(--field)",
          border: "1px solid var(--fieldLine)",
          borderRadius: 10,
          font: "600 13px/1 'Inter'",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        {pendingView ? "Opening…" : "View as"}
      </button>

      {armed ? (
        <>
          <button
            type="button"
            className="a-dangerbtn"
            disabled={pendingDel}
            onClick={del}
            style={{
              height: 38,
              padding: "0 13px",
              background: "var(--dangerBg)",
              border: "1px solid var(--dangerLine)",
              borderRadius: 10,
              font: "600 13px/1 'Inter'",
              color: "var(--danger)",
              cursor: "pointer",
            }}
          >
            {pendingDel ? "Deleting…" : "Confirm"}
          </button>
          <button
            type="button"
            className="a-ghostbtn"
            disabled={pendingDel}
            onClick={() => setArmed(false)}
            style={{
              height: 38,
              padding: "0 13px",
              background: "var(--field)",
              border: "1px solid var(--fieldLine)",
              borderRadius: 10,
              font: "600 13px/1 'Inter'",
              color: "var(--ink2)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label="Delete contractor"
          className="a-dangerbtn"
          onClick={() => setArmed(true)}
          style={{
            width: 38,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--field)",
            border: "1px solid var(--dangerLine)",
            borderRadius: 10,
            color: "var(--danger)",
            cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
          </svg>
        </button>
      )}
    </div>
  );
}
