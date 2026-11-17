"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { syncWixContractors } from "@/app/actions/admin";
import { todoButtonStyle } from "@/components/admin/todo-button-style";

/** Runs the landys.co contractor sync in place, then refreshes the page. */
export function SyncContractorsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncWixContractors(false);
      setMessage({ ok: result.ok, text: result.message ?? (result.ok ? "Contractors synced." : "Sync failed.") });
      if (result.ok) router.refresh();
    });
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button type="button" onClick={run} disabled={pending} className="a-ghostbtn" style={todoButtonStyle}>
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
        {pending ? "Syncing" : "Sync contractors"}
      </button>
      {message && (
        <span
          role="status"
          style={{
            maxWidth: 320,
            textAlign: "right",
            font: "400 13px/1.4 var(--ui)",
            color: message.ok ? "var(--pos)" : "var(--danger)",
          }}
        >
          {message.text}
        </span>
      )}
    </span>
  );
}
