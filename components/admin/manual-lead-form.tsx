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

const STEPS = ["Landowner", "Property", "Job details"] as const;

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
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({ ...EMPTY, projectTypeId: projectTypes[0]?.id ?? "" });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.landownerName.trim()) return "Landowner name is required.";
      if (!form.landownerPhone.trim()) return "Phone is required.";
      if (!form.landownerEmail.trim()) return "Email is required.";
    }
    if (s === 1) {
      if (!form.propertyLocation.trim()) return "Property location is required.";
    }
    if (s === 2) {
      if (!form.projectTypeId) return "Project type is required.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((v) => Math.min(v + 1, STEPS.length - 1));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      next();
      return;
    }
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
              setStep(0);
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
      <StepIndicator steps={STEPS} current={step} />

      {step === 0 && (
        <section className="flex flex-col gap-5">
          <StepTitle title="Landowner" subtitle="Contact details for this lead." />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="ln">Landowner name</Label>
              <Input
                id="ln"
                value={form.landownerName}
                onChange={(e) => set("landownerName", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lp">Landowner phone</Label>
              <Input
                id="lp"
                type="tel"
                value={form.landownerPhone}
                onChange={(e) => set("landownerPhone", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="le">Landowner email</Label>
            <Input
              id="le"
              type="email"
              value={form.landownerEmail}
              onChange={(e) => set("landownerEmail", e.target.value)}
            />
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-5">
          <StepTitle title="Property" subtitle="Where is the job?" />
          <div>
            <Label htmlFor="loc">Property location</Label>
            <Input
              id="loc"
              value={form.propertyLocation}
              onChange={(e) => set("propertyLocation", e.target.value)}
            />
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
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-5">
          <StepTitle title="Job details" subtitle="What work and which tier?" />
          <div>
            <Label htmlFor="pt">Project type</Label>
            <Select
              id="pt"
              value={form.projectTypeId}
              onChange={(e) => set("projectTypeId", e.target.value)}
            >
              {projectTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.contractorTypeName} — {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tier">Tier</Label>
            <Select id="tier" value={form.tier} onChange={(e) => set("tier", e.target.value)}>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </Select>
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="accent" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="submit" variant="accent" loading={pending} disabled={pending}>
            Create &amp; distribute lead
          </Button>
        )}
      </div>
    </form>
  );
}

function StepIndicator({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="mb-1 flex items-center gap-2" aria-label="Form steps">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              font: "600 12px/1 'Inter'",
              background: i <= current ? "var(--gold)" : "var(--field)",
              color: i <= current ? "#fff" : "var(--ink3)",
              border: i <= current ? "none" : "1px solid var(--fieldLine)",
            }}
          >
            {i + 1}
          </span>
          <span
            className="hidden sm:inline"
            style={{
              font: "600 12px/1 'Inter'",
              color: i === current ? "var(--ink)" : "var(--ink3)",
            }}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <span style={{ width: 18, height: 1, background: "var(--line)", display: "inline-block" }} />
          )}
        </li>
      ))}
    </ol>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 style={{ margin: 0, font: "600 18px/1.2 'Inter'", color: "var(--ink)" }}>{title}</h2>
      <p style={{ margin: "6px 0 0", font: "400 13px/1.4 'Inter'", color: "var(--ink2)" }}>{subtitle}</p>
    </div>
  );
}
