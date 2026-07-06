"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createManualLead } from "@/app/actions/admin";

type ProjectType = { id: string; name: string; contractorTypeName: string };

export function ManualLeadForm({
  projectTypes,
  landTypes,
}: {
  projectTypes: ProjectType[];
  landTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    landownerName: "",
    landownerEmail: "",
    landownerPhone: "",
    propertyLocation: "",
    projectTypeId: projectTypes[0]?.id ?? "",
    tier: "1",
    landTypeId: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
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
      setResult({ ok: res.ok, message: res.message ?? (res.ok ? "Created" : "Failed") });
      if (res.ok) router.refresh();
    });
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

      {result && (
        <p
          className={
            result.ok
              ? "rounded-sm bg-success-soft p-3 text-sm font-medium text-success"
              : "rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger"
          }
        >
          {result.message}
        </p>
      )}

      <Button type="submit" variant="accent" loading={pending} disabled={pending}>
        Create &amp; distribute lead
      </Button>
    </form>
  );
}
