"use client";

import { useState, useTransition } from "react";
import { syncWixContractors } from "@/app/actions/admin";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

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
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 16,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
      <p style={{ margin: 0, font: "600 17px/1.3 var(--head)", color: "var(--ink)" }}>
        Import from landys.co
      </p>
      <p style={{ margin: "4px 0 0", font: "400 14px/1.45 var(--ui)", color: "var(--ink2)" }}>
        Runs every 6 hours. Last import: {lastSuccessAt ? formatWhen(lastSuccessAt) : "never"}
        {lastAttemptAt && lastAttemptAt !== lastSuccessAt ? `. Last attempt: ${formatWhen(lastAttemptAt)}` : ""}.
      </p>
      {lastResult && (
        <p style={{ margin: "4px 0 0", font: "400 14px/1.45 var(--ui)", color: "var(--ink3)" }}>
          Last result: {lastResult.created} added, {lastResult.updated} updated, {lastResult.unchanged} unchanged
          {lastResult.unresolved ? `, ${lastResult.unresolved} could not be matched` : ""}
          {lastResult.errors.length ? `, ${lastResult.errors.length} errors` : ""}.
        </p>
      )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="a-gold"
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--gold)",
            color: "#fff",
            font: "600 14px/1 var(--ui)",
            cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Importing" : "Import now"}
        </button>
      </div>
      {message && (
        <p
          style={{
            margin: 0,
            flexBasis: "100%",
            font: "500 14px/1.4 var(--ui)",
            color: error ? "var(--danger)" : "var(--sageFg)",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
