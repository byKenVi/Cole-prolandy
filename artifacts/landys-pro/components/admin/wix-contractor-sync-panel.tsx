"use client";

import { useState, useTransition } from "react";
import { syncWixContractors } from "@/app/actions/admin";

export function WixContractorSyncPanel({
  lastSuccessAt,
  lastAttemptAt,
  lastResult,
}: {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastResult: {
    created: number;
    updated: number;
    unchanged: number;
    unresolved: number;
    errors: string[];
  } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function run(dryRun: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await syncWixContractors(dryRun);
      setError(!result.ok);
      setMessage(result.message ?? (result.ok ? "Sync complete." : "Sync failed."));
    });
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "16px 18px",
        marginBottom: 16,
      }}
    >
      <p style={{ margin: "0 0 6px", font: "600 14px/1.3 'Inter'", color: "var(--ink)" }}>
        Wix contractor sync
      </p>
      <p style={{ margin: "0 0 12px", font: "400 12px/1.4 'Inter'", color: "var(--ink3)" }}>
        Canonical external ID: Wix <code>_id</code>. Last success: {lastSuccessAt ?? "never"}. Last
        attempt: {lastAttemptAt ?? "never"}.
      </p>
      {lastResult && (
        <p style={{ margin: "0 0 12px", font: "400 12px/1.4 'Inter'", color: "var(--ink2)" }}>
          Latest: {lastResult.created} created, {lastResult.updated} updated,{" "}
          {lastResult.unchanged} unchanged, {lastResult.unresolved} unresolved
          {lastResult.errors.length ? `, ${lastResult.errors.length} errors` : ""}.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="a-gold"
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 10,
            border: "none",
            background: "var(--gold)",
            color: "#fff",
            font: "600 13px/1 'Inter'",
            cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Syncing…" : "Sync Wix contractors now"}
        </button>
      </div>
      {message && (
        <p
          style={{
            margin: "10px 0 0",
            font: "500 12px/1.4 'Inter'",
            color: error ? "var(--danger)" : "var(--sageFg)",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
