"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { refundLead } from "@/app/actions/admin";

export function RefundButton({
  leadMatchId,
  label = "Restore to wallet",
}: {
  leadMatchId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    const reason = window.prompt("Reason for restoring this lead charge to the wallet?");
    if (!reason) return;
    startTransition(async () => {
      const res = await refundLead(leadMatchId, reason);
      setMsg(res.message ?? (res.ok ? "Restored" : "Failed"));
      if (res.ok) router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onClick} loading={pending} disabled={pending}>
        {label}
      </Button>
      {msg && <span className="text-xs text-text-muted">{msg}</span>}
    </span>
  );
}
