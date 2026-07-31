"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { TrashIcon } from "@/components/admin/trash-icon";

type DeleteResult = { ok: boolean; message?: string };

/**
 * Delete action guarded by a modal confirmation.
 *
 * Failures render inside the dialog (it stays open); success closes the dialog,
 * raises a toast and refreshes the list so the removed row disappears without a
 * manual reload.
 */
export function DeleteButton({
  onDelete,
  redirectTo,
  label = "Delete",
  confirmLabel = "Delete",
  title,
  description,
  successMessage,
  size = "sm",
  showTrashIcon = true,
  destructive = true,
}: {
  onDelete: () => Promise<DeleteResult>;
  redirectTo?: string;
  label?: string;
  confirmLabel?: string;
  title?: string;
  description?: string;
  successMessage?: string;
  size?: "sm" | "default";
  showTrashIcon?: boolean;
  destructive?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <span className="inline-flex items-center gap-1.5">
          {showTrashIcon && <TrashIcon size={16} />}
          {label}
        </span>
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title ?? `${confirmLabel}?`}
        description={
          description ??
          (destructive ? "This action is permanent and cannot be undone." : undefined)
        }
        confirmLabel={confirmLabel}
        destructive={destructive}
        onConfirm={onDelete}
        onSuccess={() => {
          toast.success(successMessage ?? "Deleted successfully.");
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        }}
      />
    </>
  );
}
