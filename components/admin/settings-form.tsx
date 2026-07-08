"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSetting } from "@/app/actions/admin";

export function SettingsForm({
  maxLeadRecipients,
  leadExpiryHours,
}: {
  maxLeadRecipients: number;
  leadExpiryHours: number;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [recipients, setRecipients] = useState(String(maxLeadRecipients));
  const [hours, setHours] = useState(String(leadExpiryHours));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    startTransition(async () => {
      const r1 = await updateSetting("maxLeadRecipients", Number(recipients));
      const r2 = await updateSetting("leadExpiryHours", Number(hours));
      if (!r1.ok) return setStatus(r1.message);
      if (!r2.ok) return setStatus(r2.message);
      setStatus("Saved");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-5">
      <div>
        <Label htmlFor="recipients">Max lead recipients (shared leads)</Label>
        <Input
          id="recipients"
          type="number"
          min="1"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
        />
        <p className="mt-1 text-xs text-text-muted">
          Up to this many contractors receive each lead. Minimum 1.
        </p>
      </div>
      <div>
        <Label htmlFor="hours">Lead expiry (hours)</Label>
        <Input
          id="hours"
          type="number"
          min="1"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        <p className="mt-1 text-xs text-text-muted">
          A lead can no longer be accepted after this many hours.
        </p>
      </div>

      {status && (
        <p
          className={
            status === "Saved"
              ? "rounded-sm bg-success-soft p-3 text-sm font-medium text-success"
              : "rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger"
          }
        >
          {status}
        </p>
      )}

      <Button type="submit" variant="accent" loading={pending} disabled={pending}>
        Save settings
      </Button>
    </form>
  );
}
