"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { viewAsContractor } from "@/app/actions/dev";
import {
  deactivateContractor,
  reactivateContractor,
  resendContractorInvitation,
} from "@/app/actions/admin";
import { TrashIcon } from "@/components/admin/trash-icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Per-row "View as" + deactivate/reactivate controls for the contractors list.
 *
 * Outcomes are reported through toasts and the confirmation dialog rather than
 * inline text, so a long error never widens the row or pushes buttons off screen.
 */
const rowBtn: React.CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  background: "var(--field)",
  border: "1px solid var(--fieldLine)",
  borderRadius: 10,
  font: "600 12px/1 'Inter'",
  color: "var(--ink)",
  cursor: "pointer",
};

export function ContractorRowActions({
  contractorId,
  contractorName,
  deactivated,
  signedIn,
}: {
  contractorId: string;
  contractorName?: string;
  deactivated?: boolean;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendingView, startView] = useTransition();
  const [pendingInvite, startInvite] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const who = contractorName ?? "This contractor";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 8,
      }}
    >
      {!signedIn && (
        <button
          type="button"
          className="a-ghostbtn"
          disabled={pendingInvite || deactivated}
          onClick={() =>
            startInvite(async () => {
              const res = await resendContractorInvitation(contractorId);
              if (res.ok) toast.success(`Invitation sent to ${who}.`);
              else toast.error(res.message);
            })
          }
          style={{
            ...rowBtn,
            cursor: deactivated ? "not-allowed" : "pointer",
            opacity: deactivated ? 0.5 : 1,
          }}
        >
          {pendingInvite ? "Sending…" : "Send invite"}
        </button>
      )}

      <button
        type="button"
        className="a-ghostbtn"
        disabled={pendingView || deactivated}
        onClick={() => startView(() => viewAsContractor(contractorId))}
        style={{
          ...rowBtn,
          cursor: deactivated ? "not-allowed" : "pointer",
          opacity: deactivated ? 0.5 : 1,
        }}
      >
        {pendingView ? "…" : "View as"}
      </button>

      <button
        type="button"
        aria-label={deactivated ? "Reactivate contractor" : "Deactivate contractor"}
        className="a-dangerbtn"
        onClick={() => setConfirmOpen(true)}
        style={{
          ...rowBtn,
          padding: deactivated ? "0 13px" : 0,
          width: deactivated ? "auto" : 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          border: `1px solid ${deactivated ? "var(--fieldLine)" : "var(--dangerLine)"}`,
          color: deactivated ? "var(--ink2)" : "var(--danger)",
        }}
      >
        {deactivated ? "Reactivate" : <TrashIcon size={18} />}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={deactivated ? "Reactivate this contractor?" : "Deactivate this contractor?"}
        description={
          deactivated
            ? `${who} will regain access to the portal and start receiving leads again.`
            : `${who} will lose portal access and stop receiving new leads. You can reactivate them later.`
        }
        confirmLabel={deactivated ? "Reactivate" : "Deactivate"}
        destructive={!deactivated}
        onConfirm={() =>
          deactivated ? reactivateContractor(contractorId) : deactivateContractor(contractorId)
        }
        onSuccess={() => {
          toast.success(deactivated ? `${who} reactivated.` : `${who} deactivated.`);
          router.refresh();
        }}
      />
    </div>
  );
}
