"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createManualLead } from "@/app/actions/admin";

type ProjectType = { id: string; name: string; contractorTypeName: string };

const EMPTY = {
  landownerName: "",
  landownerEmail: "",
  landownerPhone: "",
  propertyLocation: "",
  tier: "1",
  landTypeId: "",
};

export function ManualLeadForm({
  projectTypes,
  landTypes,
}: {
  projectTypes: ProjectType[];
  landTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ leadId: string; recipients: number } | null>(null);

  const [form, setForm] = useState({ ...EMPTY, projectTypeId: projectTypes[0]?.id ?? "" });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createManualLead({
        landownerName: form.landownerName,
        landownerEmail: form.landownerEmail,
        landownerPhone: form.landownerPhone,
        propertyLocation: form.propertyLocation,
        projectTypeId: form.projectTypeId,
        tier: Number(form.tier),
        landTypeId: form.landTypeId || undefined,
      });
      if (res.ok && res.leadId) {
        setDone({ leadId: res.leadId, recipients: res.recipients ?? 0 });
        router.refresh();
      } else {
        setError(res.message ?? "Failed to create lead.");
      }
    });
  }

  // Admin-facing confirmation screen (this is the internal ops surface, not the
  // landowner site — the public estimate form has its own landowner wording).
  if (done) {
    return (
      <Card className="flex max-w-xl flex-col items-center gap-3 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="font-display text-2xl font-semibold text-text">Lead created</p>
        <p className="text-base text-text-muted">
          Distributed to {done.recipients} contractor(s).
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="brand">
            <Link href={`/admin/leads/${done.leadId}`}>View lead</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setForm({ ...EMPTY, projectTypeId: projectTypes[0]?.id ?? "" });
              setDone(null);
            }}
          >
            Create another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5">
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

      <div>
        <Label htmlFor="pt">Project type</Label>
        <Select id="pt" value={form.projectTypeId} onChange={(e) => set("projectTypeId", e.target.value)}>
          {projectTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.contractorTypeName} — {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="tier">Tier</Label>
          <Select id="tier" value={form.tier} onChange={(e) => set("tier", e.target.value)}>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="lt">Land type (optional)</Label>
          <Select id="lt" value={form.landTypeId} onChange={(e) => set("landTypeId", e.target.value)}>
            <option value="">—</option>
            {landTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
      )}

      <Button type="submit" variant="accent" loading={pending} disabled={pending}>
        Create &amp; distribute lead
      </Button>
    </form>
  );
}
