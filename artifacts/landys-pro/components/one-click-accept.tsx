"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { acceptLeadAction } from "@/app/actions/leads";
import { useToast } from "@/components/ui/toast";

export function OneClickAccept({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  function handleAccept(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (done || pending) return;
    setFailed(false);
    startTransition(async () => {
      const res = await acceptLeadAction(matchId);
      if (res.ok) {
        setDone(true);
        toast.success("Accepted — the landowner's contact is now unlocked.");
        router.refresh();
      } else {
        setFailed(true);
        toast.error(res.message ?? "We couldn't accept that opportunity. Please try again.");
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#2F4A3C] px-[15px] text-[13px] font-semibold text-white">
        <CheckCircle2 className="h-[14px] w-[14px]" strokeWidth={2.2} aria-hidden />
        Accepted
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={pending}
      className="contractor-action-primary min-w-[108px]"
    >
      {pending ? <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden /> : null}
      {pending ? "Accepting…" : failed ? "Retry" : "Accept"}
    </button>
  );
}
