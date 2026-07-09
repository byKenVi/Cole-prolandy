"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ProjectIcon } from "@/components/project-icon";
import { cn } from "@/lib/utils";

type ProjectType = {
  id: string;
  name: string;
  contractorTypeName: string;
  icon?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EstimateForm({
  projectTypes,
  landTypes,
}: {
  projectTypes: ProjectType[];
  landTypes: { id: string; name: string }[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    location: "",
    projectTypeId: "",
    landTypeId: "",
    description: "",
    company: "", // honeypot
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // One entry per step. `valid` gates advancing; `optional` steps are always
  // valid so the landowner can skip them.
  const steps = useMemo(
    () => [
      { key: "service", valid: () => form.projectTypeId.trim().length > 0 },
      { key: "location", valid: () => form.location.trim().length >= 2 },
      { key: "land", valid: () => true },
      {
        key: "contact",
        valid: () =>
          form.name.trim().length >= 2 &&
          form.phone.trim().length >= 7 &&
          EMAIL_RE.test(form.email.trim()),
      },
      { key: "details", valid: () => true },
    ],
    [form],
  );

  const isLast = step === steps.length - 1;
  const currentValid = steps[step]!.valid();
  const progress = Math.round(((step + 1) / steps.length) * 100);

  async function doSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, landTypeId: form.landTypeId || null }),
      });
      const json = await res.json();
      if (res.ok && json.ok) setDone(true);
      else setError(json.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    // Enter key and Next button both route through here; only the last step
    // actually POSTs, otherwise we advance.
    e.preventDefault();
    if (!currentValid) return;
    if (isLast) void doSubmit();
    else setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <p className="font-fraunces text-2xl font-semibold text-text">Request received</p>
        <p className="max-w-sm font-inter text-base text-text-muted">
          Your request has been sent to our contractors — they&apos;ll reach out to you soon. No need
          to do anything else.
        </p>
      </Card>
    );
  }

  const selectedProject = projectTypes.find((p) => p.id === form.projectTypeId);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Honeypot: hidden from users, tempting to bots. */}
      <input
        type="text"
        name="company"
        value={form.company}
        onChange={(e) => set("company", e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {/* Progress */}
      <div>
        <div className="mb-2 flex items-center justify-between font-inter text-xs font-medium text-text-muted">
          <span>
            Step {step + 1} of {steps.length}
          </span>
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
            className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div key={step} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step === 0 && (
          <Step
            title="What do you need done?"
            subtitle="Pick the service that fits your project best."
          >
            <fieldset>
              <legend className="sr-only">Choose a service</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {projectTypes.map((p) => {
                  const selected = p.id === form.projectTypeId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => set("projectTypeId", p.id)}
                      className={cn(
                        "group relative flex flex-col items-center gap-2 rounded-md border bg-surface p-4 text-center transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
                        selected
                          ? "border-accent bg-accent/5 shadow-sm ring-1 ring-accent"
                          : "border-border hover:border-accent/60 hover:bg-primary-soft/40",
                      )}
                    >
                      {selected && (
                        <span
                          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground"
                          aria-hidden
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <ProjectIcon
                        icon={p.icon}
                        category={p.contractorTypeName}
                        project={p.name}
                        size="lg"
                        className="transition-transform group-hover:scale-105"
                      />
                      <span className="font-inter text-sm font-medium leading-tight text-text">
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Step>
        )}

        {step === 1 && (
          <Step
            title="Where's the property?"
            subtitle="Tell us where the work needs to happen."
          >
            <Label htmlFor="location">Property location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="City, State"
              autoFocus
              required
            />
          </Step>
        )}

        {step === 2 && (
          <Step
            title="What type of land?"
            subtitle="Optional — this helps us match the right pro. You can skip it."
          >
            <fieldset>
              <legend className="sr-only">Choose a land type (optional)</legend>
              <div className="flex flex-wrap gap-2">
                <ChipButton
                  selected={form.landTypeId === ""}
                  onClick={() => set("landTypeId", "")}
                >
                  Not sure
                </ChipButton>
                {landTypes.map((t) => (
                  <ChipButton
                    key={t.id}
                    selected={form.landTypeId === t.id}
                    onClick={() => set("landTypeId", t.id)}
                  >
                    {t.name}
                  </ChipButton>
                ))}
              </div>
            </fieldset>
          </Step>
        )}

        {step === 3 && (
          <Step title="How can the pros reach you?" subtitle="We'll only share this with the contractors who take your job.">
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  autoComplete="name"
                  autoFocus
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  autoComplete="tel"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Anything else?" subtitle="Optional — add any details that help the pros understand your project.">
            {selectedProject && (
              <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-primary-soft/40 p-3">
                <ProjectIcon
                  icon={selectedProject.icon}
                  category={selectedProject.contractorTypeName}
                  project={selectedProject.name}
                  size="sm"
                />
                <div className="font-inter text-sm">
                  <p className="font-medium text-text">{selectedProject.name}</p>
                  <p className="text-text-muted">{selectedProject.contractorTypeName}</p>
                </div>
              </div>
            )}
            <Label htmlFor="desc">Project details</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe your project, timeline, access, acreage…"
              autoFocus
            />
          </Step>
        )}
      </div>

      {error && (
        <p className="rounded-sm bg-danger-soft p-3 font-inter text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={submitting}
            className="shrink-0"
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
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-fraunces text-2xl font-semibold text-text">{title}</h2>
        {subtitle && <p className="mt-1 font-inter text-sm text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ChipButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2.5 font-inter text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
        selected
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface text-text hover:border-accent/60 hover:bg-primary-soft/40",
      )}
    >
      {children}
    </button>
  );
}
