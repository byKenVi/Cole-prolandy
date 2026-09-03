"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createManualLead } from "@/app/actions/admin";
import { dollarsToCents } from "@/lib/money";

type TaxonomyOption = { code: string; name: string };

const TIMELINES: TaxonomyOption[] = [
  { code: "asap", name: "As soon as possible" },
  { code: "within-2-weeks", name: "Within 2 weeks" },
  { code: "within-1-month", name: "Within 1 month" },
  { code: "1-3-months", name: "1–3 months" },
  { code: "3-plus-months", name: "3+ months" },
  { code: "just-researching", name: "Just researching" },
];

const URGENCIES: TaxonomyOption[] = [
  { code: "emergency", name: "Emergency" },
  { code: "high", name: "High" },
  { code: "medium", name: "Medium" },
  { code: "low", name: "Low" },
];

const EMPTY = {
  landownerName: "",
  landownerEmail: "",
  landownerPhone: "",
  propertyZip: "",
  landTypeCode: "",
  contractorCategoryCode: "",
  workTypeCode: "",
  description: "",
  budgetDollars: "",
  timelineCode: "",
  urgencyCode: "",
};

const LABEL: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  font: "600 12px/1 var(--mono)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

const FIELD: React.CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--field)",
  color: "var(--ink)",
  font: "500 15px/1.3 'Inter'",
};

const HINT: React.CSSProperties = {
  margin: "8px 0 0",
  font: "400 13px/1.4 'Inter'",
  color: "var(--ink3)",
};

export function ManualLeadForm({
  contractorCategories,
  workTypes,
  landTypes,
}: {
  contractorCategories: TaxonomyOption[];
  workTypes: TaxonomyOption[];
  landTypes: TaxonomyOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    leadId: string;
    recipients: number;
    reviewStatus: "pending_review" | "routed";
  } | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [step, setStep] = useState(0);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): string | null {
    if (form.landownerName.trim().length < 2) return "Landowner name is required.";
    if (form.landownerPhone.trim().length < 7) return "A valid phone number is required.";
    if (!form.landownerEmail.trim()) return "Landowner email is required.";
    if (!/^\d{5}(?:-\d{4})?$/.test(form.propertyZip.trim())) {
      return "Enter a valid property ZIP code.";
    }
    if (!form.landTypeCode) return "Choose a land type.";
    if (!form.contractorCategoryCode) return "Choose the contractor category.";
    if (!form.workTypeCode) return "Choose the type of work.";
    if (form.description.trim().length < 10) {
      return "Add at least 10 characters describing the project.";
    }
    const budgetCents = dollarsToCents(form.budgetDollars.replace(/[$,\s]/g, ""));
    if (budgetCents <= 0) return "Estimated project budget is required.";
    if (!form.timelineCode) return "Choose the project timeline.";
    if (!form.urgencyCode) return "Choose the urgency.";
    return null;
  }

  function validateStep(n: number): string | null {
    if (n === 0) {
      if (form.landownerName.trim().length < 2) return "Landowner name is required.";
      if (form.landownerPhone.trim().length < 7) return "A valid phone number is required.";
      if (!form.landownerEmail.trim()) return "Landowner email is required.";
      if (!/^\d{5}(?:-\d{4})?$/.test(form.propertyZip.trim())) return "Enter a valid property ZIP code.";
      return null;
    }
    if (n === 1) {
      if (!form.landTypeCode) return "Choose a land type.";
      if (!form.contractorCategoryCode) return "Choose the contractor category.";
      if (!form.workTypeCode) return "Choose the type of work.";
      return null;
    }
    if (n === 2) {
      if (form.description.trim().length < 10) return "Add at least 10 characters describing the project.";
      const budgetCents = dollarsToCents(form.budgetDollars.replace(/[$,\s]/g, ""));
      if (budgetCents <= 0) return "Estimated project budget is required.";
      if (!form.timelineCode) return "Choose the project timeline.";
      if (!form.urgencyCode) return "Choose the urgency.";
      return null;
    }
    return validate();
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(3, s + 1));
  }

  function createOpportunity() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    const budgetCents = dollarsToCents(form.budgetDollars.replace(/[$,\s]/g, ""));

    startTransition(async () => {
      const result = await createManualLead({
        landownerName: form.landownerName.trim(),
        landownerEmail: form.landownerEmail.trim(),
        landownerPhone: form.landownerPhone.trim(),
        propertyZip: form.propertyZip.trim(),
        landTypeCode: form.landTypeCode,
        contractorCategoryCode: form.contractorCategoryCode,
        workTypeCode: form.workTypeCode,
        description: form.description.trim(),
        budgetCents,
        timelineCode: form.timelineCode,
        urgencyCode: form.urgencyCode,
      });
      if (result.ok && result.leadId) {
        setDone({
          leadId: result.leadId,
          recipients: result.recipients ?? 0,
          reviewStatus: result.reviewStatus ?? "pending_review",
        });
        router.refresh();
      } else {
        setError(result.message ?? "Failed to create opportunity.");
      }
    });
  }

  if (done) {
    const routed = done.reviewStatus === "routed";
    return (
      <div className="flex flex-col items-center gap-3.5 px-2 py-7 text-center">
        <CheckCircle2 className="h-12 w-12" style={{ color: "var(--sageFg)" }} />
        <p style={{ margin: 0, font: "600 26px/1.2 var(--display)", color: "var(--ink)" }}>
          Opportunity created
        </p>
        <p style={{ margin: 0, maxWidth: 480, font: "400 15px/1.5 'Inter'", color: "var(--ink2)" }}>
          {routed
            ? `Distributed to ${done.recipients} contractor${done.recipients === 1 ? "" : "s"}.`
            : "Saved for admin review because one or more routing details need attention."}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2.5">
          <Button asChild variant="brand">
            <Link href={`/admin/leads/${done.leadId}`}>View opportunity</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setForm({ ...EMPTY });
              setDone(null);
            }}
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  const STEPS = ["Landowner", "Project", "Details", "Review"];
  const workName = workTypes.find((o) => o.code === form.workTypeCode)?.name ?? form.workTypeCode;
  const landName = landTypes.find((o) => o.code === form.landTypeCode)?.name ?? form.landTypeCode;
  const catName =
    contractorCategories.find((o) => o.code === form.contractorCategoryCode)?.name ?? form.contractorCategoryCode;

  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-7">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STEPS.map((label, i) => (
          <span
            key={label}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              font: "600 12px/1 'Inter'",
              background: i === step ? "var(--goldSoft)" : "var(--card2)",
              color: i === step ? "var(--goldSoftFg)" : "var(--ink3)",
              border: i === step ? "1px solid var(--gold)" : "1px solid var(--line)",
            }}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <Section kicker="01 · Landowner" title="Who needs the work?" subtitle="Contact contractors receive only after they accept.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="landowner-name">
              <Input id="landowner-name" style={FIELD} value={form.landownerName} onChange={(event) => set("landownerName", event.target.value)} autoComplete="name" placeholder="Jane Landowner" />
            </Field>
            <Field label="Phone" htmlFor="landowner-phone">
              <Input id="landowner-phone" type="tel" style={FIELD} value={form.landownerPhone} onChange={(event) => set("landownerPhone", event.target.value)} autoComplete="tel" placeholder="(512) 555-0100" />
            </Field>
            <Field label="Email" htmlFor="landowner-email">
              <Input id="landowner-email" type="email" style={FIELD} value={form.landownerEmail} onChange={(event) => set("landownerEmail", event.target.value)} autoComplete="email" placeholder="jane@example.com" />
            </Field>
            <Field label="Property ZIP" htmlFor="property-zip">
              <Input id="property-zip" inputMode="numeric" style={FIELD} value={form.propertyZip} onChange={(event) => set("propertyZip", event.target.value)} placeholder="78701" />
            </Field>
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section kicker="02 · Project" title="What kind of work?" subtitle="Current taxonomy used for matching.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Land type" htmlFor="land-type">
              <TaxonomySelect id="land-type" value={form.landTypeCode} placeholder="Choose land type…" options={landTypes} onChange={(value) => set("landTypeCode", value)} />
            </Field>
            <Field label="Contractor category" htmlFor="contractor-category">
              <TaxonomySelect id="contractor-category" value={form.contractorCategoryCode} placeholder="Choose a trade…" options={contractorCategories} onChange={(value) => set("contractorCategoryCode", value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Type of work" htmlFor="work-type">
                <TaxonomySelect id="work-type" value={form.workTypeCode} placeholder="Choose work type…" options={workTypes} onChange={(value) => set("workTypeCode", value)} />
              </Field>
            </div>
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section kicker="03 · Project details" title="Budget and scope" subtitle="The landowner's submitted budget is an estimate, not a final contract value.">
          <div className="flex flex-col gap-4">
            <Field label="Project description" htmlFor="project-description">
              <Textarea id="project-description" rows={4} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="What needs to be done, site conditions, timing notes…" style={{ ...FIELD, height: "auto", minHeight: 112, padding: "12px 14px", resize: "vertical", lineHeight: 1.45 }} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Estimated budget" htmlFor="project-value">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold" style={{ color: "var(--ink3)" }}>$</span>
                  <Input id="project-value" inputMode="decimal" style={{ ...FIELD, paddingLeft: 28 }} value={form.budgetDollars} onChange={(event) => set("budgetDollars", event.target.value)} placeholder="25,000" />
                </div>
                <p style={HINT}>Used to preview the success-fee rate. Not the final contract.</p>
              </Field>
              <Field label="Timeline" htmlFor="timeline">
                <TaxonomySelect id="timeline" value={form.timelineCode} placeholder="Choose timeline…" options={TIMELINES} onChange={(value) => set("timelineCode", value)} />
              </Field>
              <Field label="Urgency" htmlFor="urgency">
                <TaxonomySelect id="urgency" value={form.urgencyCode} placeholder="Choose urgency…" options={URGENCIES} onChange={(value) => set("urgencyCode", value)} />
              </Field>
            </div>
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section kicker="04 · Review" title="Ready to distribute?" subtitle="Creates a free opportunity. Landy's earns only after the contractor is paid by the landowner.">
          <div className="grid gap-3 rounded-[14px] border p-4" style={{ borderColor: "var(--line)", background: "var(--card2)" }}>
            <p style={{ margin: 0, font: "600 15px/1.4 'Inter'", color: "var(--ink)" }}>{form.landownerName} · {form.propertyZip}</p>
            <p style={{ margin: 0, color: "var(--ink2)" }}>{form.landownerPhone} · {form.landownerEmail}</p>
            <p style={{ margin: 0, color: "var(--ink)" }}>{workName} · {catName} · {landName}</p>
            <p style={{ margin: 0, color: "var(--ink2)" }}>Estimated budget ${form.budgetDollars}</p>
            <p style={{ margin: 0, color: "var(--ink2)", whiteSpace: "pre-wrap" }}>{form.description}</p>
          </div>
        </Section>
      )}

      {error && <p className="rounded-xl px-3.5 py-3 text-sm font-medium" style={{ margin: 0, background: "var(--dangerSoft, #fde8e8)", color: "var(--danger, #b42318)" }}>{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }}>
          Back
        </Button>
        {step < 3 ? (
          <Button type="button" variant="accent" className="h-12 px-7 text-base" onClick={goNext}>
            Continue
          </Button>
        ) : (
          <Button type="button" variant="accent" className="h-12 px-7 text-base" loading={pending} disabled={pending} onClick={createOpportunity}>
            Create &amp; distribute
          </Button>
        )}
      </div>
    </form>
  );
}

function TaxonomySelect({ id, value, placeholder, options, onChange }: { id: string; value: string; placeholder: string; options: TaxonomyOption[]; onChange: (value: string) => void }) {
  return (
    <Select id={id} style={FIELD} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
    </Select>
  );
}

function Section({ kicker, title, subtitle, children }: { kicker: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[18px]">
      <div>
        <p style={{ margin: "0 0 8px", font: "600 11px/1 var(--mono)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--gold)" }}>{kicker}</p>
        <h2 style={{ margin: 0, font: "600 22px/1.2 var(--display)", color: "var(--ink)" }}>{title}</h2>
        <p style={{ margin: "8px 0 0", font: "400 14px/1.45 'Inter'", color: "var(--ink2)" }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div><Label htmlFor={htmlFor} style={LABEL}>{label}</Label>{children}</div>;
}
