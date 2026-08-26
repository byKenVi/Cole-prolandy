"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { landownerConfirmAction } from "@/app/actions/follow-up";

type ContractorOption = {
  leadMatchId: string;
  contractorName: string;
};

export function LandownerConfirmActions({
  token,
  contractors,
}: {
  token: string;
  contractors: ContractorOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"choice" | "pick">("choice");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(
    contractors.length === 1 ? contractors[0]!.leadMatchId : null,
  );
  const [activeAction, setActiveAction] = useState<string | null>(null);

  function submit(hired: boolean, hiredLeadMatchId?: string | null) {
    setError(null);
    setActiveAction(hired ? "yes" : "no");
    startTransition(async () => {
      const res = await landownerConfirmAction(token, hired, hiredLeadMatchId ?? null);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else setError(res.message);
      setActiveAction(null);
    });
  }

  if (done) {
    return (
      <p className="rounded-sm bg-[#E8F3EC] p-4 text-center text-sm font-medium text-[#2F6B4A]">
        Thank you — your response has been recorded.
      </p>
    );
  }

  if (step === "pick") {
    return (
      <div className="flex flex-col gap-3">
        {error && (
          <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
        )}
        <p className="text-[15px] text-[#6B6459]">Which contractor did you hire?</p>
        <div className="flex flex-col gap-2">
          {contractors.map((c) => (
            <label
              key={c.leadMatchId}
              className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-[#EBE3D4] bg-white px-4 py-3"
            >
              <input
                type="radio"
                name="contractor"
                value={c.leadMatchId}
                checked={selectedMatchId === c.leadMatchId}
                onChange={() => setSelectedMatchId(c.leadMatchId)}
                className="h-4 w-4 accent-[#C0803C]"
              />
              <span className="text-[16px] font-medium text-[#3A352D]">{c.contractorName}</span>
            </label>
          ))}
        </div>
        <Button
          variant="accent"
          size="cta"
          loading={pending && activeAction === "yes"}
          disabled={pending || !selectedMatchId}
          onClick={() => submit(true, selectedMatchId)}
        >
          Confirm
        </Button>
        <Button
          variant="outline"
          size="cta"
          disabled={pending}
          onClick={() => {
            setStep("choice");
            setError(null);
          }}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
      )}
      <p className="text-center text-[15px] text-[#6B6459]">Did you hire a contractor for this project?</p>
      <Button
        variant="accent"
        size="cta"
        disabled={pending}
        onClick={() => {
          if (contractors.length === 0) {
            setError("No contractors are linked to this project yet.");
            return;
          }
          if (contractors.length === 1) {
            submit(true, contractors[0]!.leadMatchId);
          } else {
            setStep("pick");
          }
        }}
      >
        Yes
      </Button>
      <Button
        variant="outline"
        size="cta"
        loading={pending && activeAction === "no"}
        disabled={pending}
        onClick={() => submit(false)}
      >
        No
      </Button>
    </div>
  );
}
