"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { declineLeadAction } from "@/app/actions/leads";

export function OneClickPass({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handlePass(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (done || pending) return;
    startTransition(async () => {
      const res = await declineLeadAction(matchId);
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex min-h-[48px] items-center whitespace-nowrap rounded-[12px] border border-[#E6DFD1] bg-[#F7F0E3] px-4 text-[14px] font-semibold text-[#8A7E68]">
        Passed
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handlePass}
      disabled={pending}
      className="contractor-action-secondary min-w-[88px]"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending ? "…" : "Pass"}
    </button>
  );
}
