"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordContractorPaidAction,
  recordOutcomeAction,
  resendFeeLinkAction,
  resendNewLeadAction,
  sendHireCheckNowAction,
  sendOutcomeCheckNowAction,
  sendPaymentCheckNowAction,
} from "@/app/actions/admin-ops";

export type MatchOpsRow = {
  id: string;
  contractorName: string;
  status: string;
  jobOutcome: string;
  feeStatus: string | null;
};

type Result = { ok: boolean; message: string };

const btn: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 9,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  font: "500 13px/1 Rubik, sans-serif",
  cursor: "pointer",
};

/** Admin tools to push a job forward now (QA without waiting days, and support after phone calls). */
export function MatchOpsPanel({
  leadId,
  matches,
  canSendHireCheck,
}: {
  leadId: string;
  matches: MatchOpsRow[];
  canSendHireCheck: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Result | null>(null);
  const [price, setPrice] = useState<Record<string, string>>({});

  function run(fn: () => Promise<Result>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      setMessage(res);
      router.refresh();
    });
  }

  const rows = matches.filter((m) => m.status === "PENDING" || m.status === "ACCEPTED");
  if (rows.length === 0 && !canSendHireCheck) return null;

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)", padding: 18, marginBottom: 20 }}>
      <p style={{ margin: 0, font: "600 16px/1.3 Rubik, sans-serif", color: "var(--ink)" }}>Follow-up tools</p>
      <p style={{ margin: "4px 0 14px", font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
        Send the next message now instead of waiting, or record what a contractor told you on the phone. Every action is logged.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((m) => (
          <div key={m.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <p style={{ margin: "0 0 8px", font: "600 14px/1.3 Rubik, sans-serif", color: "var(--ink)" }}>
              {m.contractorName}
              <span style={{ fontWeight: 400, color: "var(--ink2)" }}>
                {" "}
                — {m.status === "PENDING" ? "has not answered" : m.feeStatus ? `fee ${m.feeStatus.toLowerCase().replaceAll("_", " ")}` : m.jobOutcome === "OPEN" ? "accepted, outcome unknown" : m.jobOutcome.toLowerCase()}
              </span>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {m.status === "PENDING" && (
                <button type="button" style={btn} disabled={pending} onClick={() => run(() => resendNewLeadAction(m.id))}>
                  Re-send the job request
                </button>
              )}
              {m.status === "ACCEPTED" && m.jobOutcome === "OPEN" && (
                <>
                  <button type="button" style={btn} disabled={pending} onClick={() => run(() => sendOutcomeCheckNowAction(m.id))}>
                    Send &ldquo;Did you get the job?&rdquo; now
                  </button>
                  <input
                    inputMode="decimal"
                    placeholder="Final price $"
                    value={price[m.id] ?? ""}
                    onChange={(e) => setPrice((p) => ({ ...p, [m.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                    style={{ ...btn, width: 120, cursor: "text" }}
                  />
                  <button
                    type="button"
                    style={btn}
                    disabled={pending || !price[m.id]}
                    onClick={() =>
                      run(
                        () => recordOutcomeAction({ leadMatchId: m.id, won: true, finalValueDollars: Number(price[m.id]) }),
                        `Record that ${m.contractorName} won this job for $${price[m.id]}?`,
                      )
                    }
                  >
                    Record as won
                  </button>
                  <button
                    type="button"
                    style={btn}
                    disabled={pending}
                    onClick={() => run(() => recordOutcomeAction({ leadMatchId: m.id, won: false }), `Record that ${m.contractorName} was not hired?`)}
                  >
                    Record as not hired
                  </button>
                </>
              )}
              {m.feeStatus === "AWAITING_CONTRACTOR_PAYMENT" && (
                <>
                  <button type="button" style={btn} disabled={pending} onClick={() => run(() => sendPaymentCheckNowAction(m.id))}>
                    Send &ldquo;Have you been paid?&rdquo; now
                  </button>
                  <button
                    type="button"
                    style={btn}
                    disabled={pending}
                    onClick={() => run(() => recordContractorPaidAction(m.id), `Confirm the homeowner paid ${m.contractorName}? The fee becomes due.`)}
                  >
                    Record: homeowner paid them
                  </button>
                </>
              )}
              {m.feeStatus === "DUE" && (
                <button type="button" style={btn} disabled={pending} onClick={() => run(() => resendFeeLinkAction(m.id))}>
                  Re-send the payment link
                </button>
              )}
            </div>
          </div>
        ))}
        {canSendHireCheck && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <button type="button" style={btn} disabled={pending} onClick={() => run(() => sendHireCheckNowAction(leadId))}>
              Send &ldquo;Did you hire someone?&rdquo; to the homeowner now
            </button>
          </div>
        )}
      </div>

      {message && (
        <p role="status" style={{ margin: "12px 0 0", font: "500 14px/1.4 Rubik, sans-serif", color: message.ok ? "var(--pos)" : "var(--danger)" }}>
          {message.message}
        </p>
      )}
    </div>
  );
}
