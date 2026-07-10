"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { viewAsContractor } from "@/app/actions/dev";
import { deactivateContractor, reactivateContractor } from "@/app/actions/admin";
import { TrashIcon } from "@/components/admin/trash-icon";

/**
 * Per-row "View as" + deactivate/reactivate controls for the contractors list.
 */
export function ContractorRowActions({
  contractorId,
  deactivated,
}: {
  contractorId: string;
  deactivated?: boolean;
}) {
  const router = useRouter();
  const [pendingView, startView] = useTransition();
  const [pendingAct, startAct] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startAct(async () => {
      const res = deactivated
        ? await reactivateContractor(contractorId)
        : await deactivateContractor(contractorId);
      if (res.ok) {
        setArmed(false);
        router.refresh();
      } else {
        setError(res.message ?? "Could not update contractor.");
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
        disabled={pendingView || deactivated}
        onClick={() => startView(() => viewAsContractor(contractorId))}
        style={{
          height: 38,
          padding: "0 15px",
          background: "var(--field)",
          border: "1px solid var(--fieldLine)",
          borderRadius: 10,
          font: "600 13px/1 'Inter'",
          color: "var(--ink)",
          cursor: deactivated ? "not-allowed" : "pointer",
          opacity: deactivated ? 0.5 : 1,
        }}
      >
        {pendingView ? "Opening…" : "View as"}
      </button>

      {armed ? (
        <>
          <button
            type="button"
            className="a-dangerbtn"
            disabled={pendingAct}
            onClick={run}
            style={{
              height: 38,
              padding: "0 13px",
              background: deactivated ? "var(--sage)" : "var(--dangerBg)",
              border: `1px solid ${deactivated ? "var(--sage)" : "var(--dangerLine)"}`,
              borderRadius: 10,
              font: "600 13px/1 'Inter'",
              color: deactivated ? "var(--sageFg)" : "var(--danger)",
              cursor: "pointer",
            }}
          >
            {pendingAct ? "Saving…" : deactivated ? "Confirm reactivate" : "Confirm deactivate"}
          </button>
          <button
            type="button"
            className="a-ghostbtn"
            disabled={pendingAct}
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
          aria-label={deactivated ? "Reactivate contractor" : "Deactivate contractor"}
          className="a-dangerbtn"
          onClick={() => setArmed(true)}
          style={{
            height: 38,
            padding: deactivated ? "0 13px" : 0,
            width: deactivated ? "auto" : 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: "var(--field)",
            border: `1px solid ${deactivated ? "var(--fieldLine)" : "var(--dangerLine)"}`,
            borderRadius: 10,
            color: deactivated ? "var(--ink2)" : "var(--danger)",
            cursor: "pointer",
            font: "600 12px/1 'Inter'",
          }}
        >
          {deactivated ? "Reactivate" : <TrashIcon size={18} />}
        </button>
      )}
    </div>
  );
}
