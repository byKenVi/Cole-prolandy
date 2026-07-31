"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmResult = { ok: boolean; message?: string };

/**
 * Shared destructive-confirmation dialog.
 *
 * The action runs inside the dialog: a failure message renders in the dialog
 * body (never floating next to the trigger button) and the dialog stays open so
 * the user can read it. On success the dialog closes and the caller reports the
 * outcome — normally through a toast.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onSuccess,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<ConfirmResult>;
  onSuccess?: () => void;
  destructive?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Clear the previous error whenever the dialog is reopened.
  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function run() {
    setError(null);
    setPending(true);
    try {
      const res = await onConfirm();
      if (res.ok) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(res.message ?? "That didn't work. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent showClose={!pending}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            {destructive && (
              <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#F6E4E1]">
                <AlertTriangle className="h-[18px] w-[18px] text-[#9A3B2E]" />
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription className="mt-1.5">{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-[12px] bg-[#F6E4E1] px-4 py-3 text-[13px] font-medium text-[#9A3B2E]"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="sm:flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "accent"}
            onClick={run}
            loading={pending}
            disabled={pending}
            className="sm:flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
