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
    if (budgetCents <= 0) return "Estimated project value is required.";
    if (!form.timelineCode) return "Choose the project timeline.";
    if (!form.urgencyCode) return "Choose the urgency.";
    return null;
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

  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-7">
      <Section
        kicker="01 · Landowner"
        title="Who needs the work?"
        subtitle="The contact contractors receive only after they accept the opportunity."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="landowner-name">
            <Input id="landowner-name" style={FIELD} value={form.landownerName} onChange={(event) => set("landownerName", event.target.value)} autoComplete="name" placeholder="Jane Landowner" />
          </Field>
          <Field label="Phone" htmlFor="landowner-phone">
            <Input id="landowner-phone" type="tel" style={FIELD} value={form.landownerPhone} onChange={(event) => set("landownerPhone", event.target.value)} autoComplete="tel" placeholder="(512) 555-0100" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email" htmlFor="landowner-email">
              <Input id="landowner-email" type="email" style={FIELD} value={form.landownerEmail} onChange={(event) => set("landownerEmail", event.target.value)} autoComplete="email" placeholder="jane@example.com" />
            </Field>
          </div>
        </div>
      </Section>

      <Section kicker="02 · Property" title="Where is the project?" subtitle="ZIP and land type use the same live taxonomy as Landys.co.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property ZIP" htmlFor="property-zip">
            <Input id="property-zip" inputMode="numeric" style={FIELD} value={form.propertyZip} onChange={(event) => set("propertyZip", event.target.value)} placeholder="78701" />
          </Field>
          <Field label="Land type" htmlFor="land-type">
            <TaxonomySelect id="land-type" value={form.landTypeCode} placeholder="Choose land type…" options={landTypes} onChange={(value) => set("landTypeCode", value)} />
          </Field>
        </div>
      </Section>

      <Section kicker="03 · Matching" title="Who should receive it?" subtitle="Category identifies the contractor trade; work type describes the job. Both drive matching.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contractor category" htmlFor="contractor-category">
            <TaxonomySelect id="contractor-category" value={form.contractorCategoryCode} placeholder="Choose a trade…" options={contractorCategories} onChange={(value) => set("contractorCategoryCode", value)} />
          </Field>
          <Field label="Type of work" htmlFor="work-type">
            <TaxonomySelect id="work-type" value={form.workTypeCode} placeholder="Choose work type…" options={workTypes} onChange={(value) => set("workTypeCode", value)} />
          </Field>
        </div>
      </Section>

      <Section kicker="04 · Project" title="What should contractors know?" subtitle="Value, timing, urgency, and scope help a contractor decide quickly.">
        <div className="flex flex-col gap-4">
          <Field label="Project description" htmlFor="project-description">
            <Textarea id="project-description" rows={4} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="What needs to be done, site conditions, timing notes…" style={{ ...FIELD, height: "auto", minHeight: 112, padding: "12px 14px", resize: "vertical", lineHeight: 1.45 }} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Estimated project value" htmlFor="project-value">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold" style={{ color: "var(--ink3)" }}>$</span>
                <Input id="project-value" inputMode="decimal" style={{ ...FIELD, paddingLeft: 28 }} value={form.budgetDollars} onChange={(event) => set("budgetDollars", event.target.value)} placeholder="25,000" />
              </div>
              <p style={HINT}>Used to select the success-fee rate.</p>
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

      {error && <p className="rounded-xl px-3.5 py-3 text-sm font-medium" style={{ margin: 0, background: "var(--dangerSoft, #fde8e8)", color: "var(--danger, #b42318)" }}>{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-[14px] border px-[18px] py-4" style={{ background: "var(--card2)", borderColor: "var(--line)" }}>
        <p style={{ margin: 0, maxWidth: 480, font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
          This sends a free opportunity to matching contractors. Landy&apos;s earns only when a contractor wins and gets paid.
        </p>
        <Button type="button" variant="accent" className="h-12 px-7 text-base" loading={pending} disabled={pending} onClick={createOpportunity}>
          Create &amp; distribute
        </Button>
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
