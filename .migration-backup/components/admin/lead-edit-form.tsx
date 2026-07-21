"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLead } from "@/app/actions/admin";

export function LeadEditForm({
  leadId,
  initial,
}: {
  leadId: string;
  initial: {
    landownerName: string;
    landownerEmail: string;
    landownerPhone: string;
    propertyLocation: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(initial);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateLead(leadId, form);
      if (res.ok) {
        router.push(`/admin/leads/${leadId}`);
        router.refresh();
      } else {
        setMessage(res.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="rounded-sm bg-primary-soft p-3 text-sm text-text-muted">
        Only landowner contact details and location can be edited. The project, tier and price are
        locked once a lead is created so money can never shift after distribution.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="ln">Landowner name</Label>
          <Input id="ln" value={form.landownerName} onChange={(e) => set("landownerName", e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="lp">Landowner phone</Label>
          <Input id="lp" type="tel" value={form.landownerPhone} onChange={(e) => set("landownerPhone", e.target.value)} required />
        </div>
      </div>

      <div>
        <Label htmlFor="le">Landowner email</Label>
        <Input id="le" type="email" value={form.landownerEmail} onChange={(e) => set("landownerEmail", e.target.value)} required />
      </div>

      <div>
        <Label htmlFor="loc">Property location</Label>
        <Input id="loc" value={form.propertyLocation} onChange={(e) => set("propertyLocation", e.target.value)} required />
      </div>

      {message && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{message}</p>
      )}

      <Button type="submit" variant="accent" loading={pending} disabled={pending}>
        Save changes
      </Button>
    </form>
  );
}
