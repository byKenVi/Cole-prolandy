"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { viewAsContractor } from "@/app/actions/dev";

/** Admin "View as contractor" — renders the contractor's exact mobile view. */
export function ViewAsButton({ contractorId }: { contractorId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      disabled={pending}
      onClick={() => startTransition(() => viewAsContractor(contractorId))}
    >
      View as
    </Button>
  );
}
