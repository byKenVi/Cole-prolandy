"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createContractor, updateContractor, type ContractorInput } from "@/app/actions/admin";
import { BusinessHoursPicker } from "@/components/business-hours-picker";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Service area", "Profile"] as const;

/**
 * Admin contractor form. Project assignment is multi-select and admin-only
 * Project assignment supports multiple projects and remains admin-controlled.
 */
export function ContractorForm({
  mode,
  contractorId,
  initial,
  contractorTypes,
  contractorCategories,
}: {
  mode: "create" | "edit";
  contractorId?: string;
  initial: ContractorInput;
  contractorTypes: { id: string; name: string }[];
  contractorCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [contractorCategoryId, setContractorCategoryId] = useState(
    initial.contractorCategoryId,
  );
  const [projectIds, setProjectIds] = useState<string[]>(initial.projectIds);
  const [about, setAbout] = useState(initial.aboutSection ?? "");
  const [hours, setHours] = useState(initial.businessHours ?? "");
  const [isPro, setIsPro] = useState(initial.isPro);
  const [zips, setZips] = useState(initial.serviceZipCodes ?? "");
  const [counties, setCounties] = useState(initial.serviceCounties ?? "");
  const [radius, setRadius] = useState(
    initial.serviceRadiusMiles ? String(initial.serviceRadiusMiles) : "",
  );

  const isCreate = mode === "create";

  function toggleProject(id: string) {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!name.trim()) return "Business name is required.";
      if (!email.trim()) return "Email is required.";
      if (!phone.trim()) return "Phone is required.";
      if (!contractorCategoryId) return "Choose one contractor category.";
    }
    if (s === 1) {
      if (radius && (!/^\d+$/.test(radius) || Number(radius) < 1 || Number(radius) > 500)) {
        return "Radius must be a whole number of miles between 1 and 500.";
      }
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setMessage(err);
      return;
    }
    setMessage(null);
    setStep((v) => Math.min(v + 1, STEPS.length - 1));
  }

  function save() {
    if (isCreate) {
      const err = validateStep(step);
      if (err) {
        setMessage(err);
        return;
      }
    }
    const radiusError = validateStep(1);
    if (radiusError) {
      setMessage(radiusError);
      return;
    }
    setMessage(null);
    const payload: ContractorInput = {
      name,
      email,
      phone,
      contractorCategoryId,
      projectIds,
      aboutSection: about,
      businessHours: hours,
      isPro,
      serviceZipCodes: zips,
      serviceCounties: counties,
      serviceRadiusMiles: radius ? Number(radius) : null,
    };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createContractor(payload)
          : await updateContractor(contractorId!, payload);
      if (res.ok) {
        const id = mode === "create" && "contractorId" in res ? res.contractorId : contractorId;
        router.push(id ? `/admin/contractors/${id}` : "/admin/contractors");
        router.refresh();
      } else {
        setMessage(res.message);
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCreate && step < STEPS.length - 1) goNext();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-3xl flex-col gap-7">
      {isCreate && <StepIndicator steps={STEPS} current={step} />}

      {(!isCreate || step === 0) && (
        <section className="flex flex-col gap-6">
          {isCreate && <StepTitle title="Basics" subtitle="Who is this contractor?" />}
          <div>
            <Label htmlFor="name">Business / contractor name</Label>
            <Input
              id="name"
              className="h-14 text-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={!isCreate}
            />
          </div>
          <div>
            <Label htmlFor="email">Email (used to link their login later)</Label>
            <Input
              id="email"
              type="email"
              className="h-14 text-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!isCreate}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (for lead texts)</Label>
            <Input
              id="phone"
              type="tel"
              className="h-14 text-lg"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={!isCreate}
            />
          </div>
          <div>
            <Label htmlFor="contractor-category">Contractor category</Label>
            <Select
              id="contractor-category"
              className="h-14 text-lg"
              value={contractorCategoryId}
              onChange={(event) => setContractorCategoryId(event.target.value)}
              required
            >
              <option value="">Choose one category</option>
              {contractorCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-sm" style={{ color: "var(--ink2)" }}>
              Business classification only. Project eligibility is managed separately below.
            </p>
          </div>
        </section>
      )}

      {(!isCreate || step === 1) && (
        <section className="flex flex-col gap-6">
          {isCreate && (
            <StepTitle
              title="Service area"
              subtitle="Where does this contractor work? Leads are sent only inside this area."
            />
          )}
          <div>
            <Label htmlFor="zips">Service ZIP codes</Label>
            <Textarea
              id="zips"
              className="min-h-[90px] text-lg"
              value={zips}
              onChange={(e) => setZips(e.target.value)}
              placeholder="75948, 75959, 75931"
            />
            <p className="mt-1 text-sm" style={{ color: "var(--ink2)" }}>
              Separate with commas. A lead matches when the property is within the radius of any of these ZIPs.
            </p>
          </div>
          <div>
            <Label htmlFor="radius">Radius around those ZIPs (miles)</Label>
            <Input
              id="radius"
              inputMode="numeric"
              className="h-14 max-w-[200px] text-lg"
              value={radius}
              onChange={(e) => setRadius(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Default"
            />
            <p className="mt-1 text-sm" style={{ color: "var(--ink2)" }}>
              Leave empty to use the default radius from Settings.
            </p>
          </div>
          <div>
            <Label htmlFor="counties">Service counties</Label>
            <Textarea
              id="counties"
              className="min-h-[90px] text-lg"
              value={counties}
              onChange={(e) => setCounties(e.target.value)}
              placeholder={"Sabine County, TX\nNewton County, TX"}
            />
            <p className="mt-1 text-sm" style={{ color: "var(--ink2)" }}>
              One per line. Contractors synced from landys.co get their area from their landys.co profile.
            </p>
          </div>
          <details className="rounded-sm border border-border px-4 py-3">
            <summary className="cursor-pointer text-base text-text">
              Legacy land projects (optional{projectIds.length ? `, ${projectIds.length} selected` : ""})
            </summary>
          <div className="mt-3 flex flex-col gap-2">
            {contractorTypes.length === 0 && (
              <p className="text-sm text-text-muted">No projects in the catalog yet.</p>
            )}
            {contractorTypes.map((p) => {
              const checked = projectIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={cn(
                    "flex min-h-tap cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition-colors",
                    checked
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-surface hover:bg-primary-soft",
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--color-primary)]"
                    checked={checked}
                    onChange={() => toggleProject(p.id)}
                  />
                  <span className="text-base text-text">{p.name}</span>
                </label>
              );
            })}
          </div>
          {projectIds.length > 0 && (
            <div>
              <Label htmlFor="primary">Primary project (shown on profile)</Label>
              <Select
                id="primary"
                className="h-14 text-lg"
                value={projectIds[0]}
                onChange={(e) => {
                  const id = e.target.value;
                  setProjectIds([id, ...projectIds.filter((p) => p !== id)]);
                }}
              >
                {projectIds.map((id) => {
                  const p = contractorTypes.find((t) => t.id === id);
                  return (
                    <option key={id} value={id}>
                      {p?.name ?? id}
                    </option>
                  );
                })}
              </Select>
            </div>
          )}
          </details>
        </section>
      )}

      {(!isCreate || step === 2) && (
        <section className="flex flex-col gap-6">
          {isCreate && <StepTitle title="Profile" subtitle="Optional contractor profile details." />}
          <div>
            <Label>Business hours</Label>
            <div className="mt-2">
              <BusinessHoursPicker value={hours} onChange={setHours} />
            </div>
          </div>
          <div>
            <Label htmlFor="about">About the business</Label>
            <Textarea
              id="about"
              className="min-h-[120px] text-lg"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="A short description for the contractor profile."
            />
          </div>
          <label className="flex min-h-tap items-start gap-3 rounded-sm border border-border px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0"
              checked={isPro}
              onChange={(e) => setIsPro(e.target.checked)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-base text-text">Pro plan — flag only</span>
              <span className="text-sm" style={{ color: "var(--ink2)" }}>
                Does not yet affect lead distribution or billing.
              </span>
            </span>
          </label>
        </section>
      )}

      {message && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{message}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {isCreate && step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="h-14 px-6 text-base"
            onClick={() => setStep((s) => s - 1)}
            disabled={pending}
          >
            Back
          </Button>
        )}
        {isCreate && step < STEPS.length - 1 ? (
          <Button type="button" variant="accent" className="h-14 px-8 text-base" onClick={goNext}>
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            variant="accent"
            className="h-14 px-8 text-base"
            loading={pending}
            disabled={pending}
            onClick={save}
          >
            {mode === "create" ? "Create contractor" : "Save changes"}
          </Button>
        )}
      </div>
    </form>
  );
}

function StepIndicator({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="mb-2 flex flex-wrap items-center gap-2" aria-label="Form steps">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              font: "600 13px/1 'Inter'",
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
              font: "600 13px/1 'Inter'",
              color: i === current ? "var(--ink)" : "var(--ink3)",
            }}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <span style={{ width: 24, height: 1, background: "var(--line)", display: "inline-block" }} />
          )}
        </li>
      ))}
    </ol>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 style={{ margin: 0, font: "600 22px/1.2 'Inter'", color: "var(--ink)" }}>{title}</h2>
      <p style={{ margin: "8px 0 0", font: "400 15px/1.45 'Inter'", color: "var(--ink2)" }}>{subtitle}</p>
    </div>
  );
}
