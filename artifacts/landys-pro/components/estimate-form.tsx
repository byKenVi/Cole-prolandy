"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

type TaxonomyOption = { code: string; name: string };

type EstimateFormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  propertyZip: string;
  contractorCategoryCode: string;
  landTypeCode: string;
  projectTypeCode: string;
  budget: string;
  timeline: string;
  urgency: string;
  description: string;
  company: string;
};

const EMPTY_FORM: EstimateFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  propertyZip: "",
  contractorCategoryCode: "",
  landTypeCode: "",
  projectTypeCode: "",
  budget: "",
  timeline: "",
  urgency: "",
  description: "",
  company: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(?:-\d{4})?$/;

export function EstimateForm({
  projectTypes,
  landTypes,
  contractorCategories,
}: {
  projectTypes: TaxonomyOption[];
  landTypes: TaxonomyOption[];
  contractorCategories: TaxonomyOption[];
}) {
  const [form, setForm] = useState<EstimateFormState>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof EstimateFormState>(key: K, value: EstimateFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const steps = useMemo(
    () => [
      {
        valid: EMAIL_RE.test(form.email.trim()),
      },
      {
        valid:
          ZIP_RE.test(form.propertyZip.trim()) &&
          Boolean(form.landTypeCode) &&
          Boolean(form.projectTypeCode),
      },
      {
        valid:
          form.budget.trim().length > 0 &&
          form.timeline.length > 0 &&
          form.urgency.trim().length > 0 &&
          form.description.trim().length >= 10,
      },
    ],
    [form],
  );
  const isLast = step === steps.length - 1;
  const currentValid = steps[step]!.valid;
  const progress = Math.round(((step + 1) / steps.length) * 100);

  async function submitRequest() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 2,
          ...form,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          phone: form.phone || null,
          contractorCategoryCode: form.contractorCategoryCode || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentValid) return;
    if (isLast) void submitRequest();
    else setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <p className="font-fraunces text-2xl font-semibold text-text">Request received</p>
        <p className="max-w-sm font-inter text-base text-text-muted">
          Your project is safely queued for review. We&apos;ll route it after pricing is confirmed.
        </p>
        <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
          <Button asChild variant="accent">
            <Link href="/">Back to home</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDone(false);
              setStep(0);
              setForm(EMPTY_FORM);
              setError(null);
            }}
          >
            Submit another request
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <input
        type="text"
        name="company"
        value={form.company}
        onChange={(event) => set("company", event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div>
        <div className="mb-2 flex items-center justify-between font-inter text-xs font-medium text-text-muted">
          <span>Step {step + 1} of 3</span>
          <span>{progress}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-primary-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Form progress"
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step === 0 && (
          <Step title="How can we reach you?" subtitle="Only email is required.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="firstName" optional>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) => set("firstName", event.target.value)}
                />
              </Field>
              <Field label="Last name" htmlFor="lastName" optional>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) => set("lastName", event.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="phone" optional>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => set("email", event.target.value)}
                  required
                />
              </Field>
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title="Tell us about the property" subtitle="Choose from current Landy's Pro taxonomies.">
            <div className="flex flex-col gap-4">
              <Field label="Property ZIP" htmlFor="propertyZip" required>
                <Input
                  id="propertyZip"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={form.propertyZip}
                  onChange={(event) => set("propertyZip", event.target.value)}
                  placeholder="78701"
                  required
                />
              </Field>
              <Field
                label="Contractor category"
                htmlFor="contractorCategoryCode"
                optional
              >
                <Select
                  id="contractorCategoryCode"
                  value={form.contractorCategoryCode}
                  onChange={(event) =>
                    set("contractorCategoryCode", event.target.value)
                  }
                >
                  <option value="">Not sure</option>
                  {contractorCategories.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Land type" htmlFor="landTypeCode" required>
                <Select
                  id="landTypeCode"
                  value={form.landTypeCode}
                  onChange={(event) => set("landTypeCode", event.target.value)}
                  required
                >
                  <option value="">Choose land type</option>
                  {landTypes.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Project type" htmlFor="projectTypeCode" required>
                <Select
                  id="projectTypeCode"
                  value={form.projectTypeCode}
                  onChange={(event) => set("projectTypeCode", event.target.value)}
                  required
                >
                  <option value="">Choose project type</option>
                  {projectTypes.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step
            title="Describe your project"
            subtitle="File upload is not available until secure storage rules are approved."
          >
            <div className="flex flex-col gap-4">
              <Field label="Budget" htmlFor="budget" required>
                <Input
                  id="budget"
                  value={form.budget}
                  onChange={(event) => set("budget", event.target.value)}
                  placeholder="e.g. $10,000–$20,000"
                  required
                />
              </Field>
              <Field label="Timeline" htmlFor="timeline" required>
                <Input
                  id="timeline"
                  type="date"
                  value={form.timeline}
                  onChange={(event) => set("timeline", event.target.value)}
                  required
                />
              </Field>
              <Field label="Urgency" htmlFor="urgency" required>
                <Input
                  id="urgency"
                  value={form.urgency}
                  onChange={(event) => set("urgency", event.target.value)}
                  placeholder="e.g. Within 30 days"
                  required
                />
              </Field>
              <Field label="Project description" htmlFor="description" required>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="Describe the work, access, acreage, and other useful details."
                  required
                />
              </Field>
            </div>
          </Step>
        )}
      </div>

      {error && (
        <p className="rounded-sm bg-danger-soft p-3 font-inter text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={submitting}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
        )}
        <Button
          type="submit"
          variant="accent"
          size="cta"
          loading={isLast && submitting}
          disabled={!currentValid || submitting}
          className="flex-1"
        >
          {isLast ? (
            "Send my request"
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-fraunces text-2xl font-semibold text-text">{title}</h2>
        <p className="mt-1 font-inter text-sm text-text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? " *" : optional ? " (optional)" : ""}
      </Label>
      {children}
    </div>
  );
}
