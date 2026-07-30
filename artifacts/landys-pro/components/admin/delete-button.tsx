"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@/components/admin/trash-icon";

type DeleteResult = { ok: boolean; message?: string };

/**
 * Two-step delete with an inline confirm (no blocking browser dialog).
 * `onDelete` is a bound server action; on success we redirect/refresh, on
 * failure (e.g. blocked for integrity) we surface the message.
 */
export function DeleteButton({
  onDelete,
  redirectTo,
  label = "Delete",
  confirmLabel = "Confirm delete",
  size = "sm",
  showTrashIcon = true,
}: {
  onDelete: () => Promise<DeleteResult>;
  redirectTo?: string;
  label?: string;
  confirmLabel?: string;
  size?: "sm" | "default";
  showTrashIcon?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await onDelete();
      if (res.ok) {
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } else {
        // Keep armed so the error appears inside the confirmation UI, not
        // floating next to the initial delete button.
        setMsg(res.message ?? "Could not delete.");
      }
    });
  }

  if (armed) {
    return (
      <span className="relative z-10 inline-flex flex-col items-start gap-1.5">
        {msg && <span className="max-w-xs text-xs text-danger">{msg}</span>}
        <span className="inline-flex items-center gap-2">
          <Button variant="destructive" size={size} loading={pending} disabled={pending} onClick={run}>
            {confirmLabel}
          </Button>
          <Button
            variant="ghost"
            size={size}
            disabled={pending}
            onClick={() => {
              setArmed(false);
              setMsg(null);
            }}
          >
            Cancel
          </Button>
        </span>
      </span>
    );
  }

  return (
    <span className="relative z-10 inline-flex items-center gap-2">
      <Button variant="outline" size={size} onClick={() => setArmed(true)}>
        <span className="inline-flex items-center gap-1.5">
          {showTrashIcon && <TrashIcon size={16} />}
          {label}
        </span>
      </Button>
    </span>
  );
}
