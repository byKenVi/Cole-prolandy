"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createContractor, updateContractor, type ContractorInput } from "@/app/actions/admin";
import { BusinessHoursPicker } from "@/components/business-hours-picker";

type Svc = { id: string; name: string; contractorTypeId: string };

const STEPS = ["Basics", "Trade & services", "Profile"] as const;

export function ContractorForm({
  mode,
  contractorId,
  initial,
  contractorTypes,
  services,
}: {
  mode: "create" | "edit";
  contractorId?: string;
  initial: ContractorInput;
  contractorTypes: { id: string; name: string }[];
  services: Svc[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [typeId, setTypeId] = useState(initial.contractorTypeId);
  const [about, setAbout] = useState(initial.aboutSection ?? "");
  const [hours, setHours] = useState(initial.businessHours ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds);
  const [isPro, setIsPro] = useState(initial.isPro);

  const isCreate = mode === "create";

  const typeServices = useMemo(
    () => services.filter((s) => s.contractorTypeId === typeId),
    [services, typeId],
  );

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!name.trim()) return "Business name is required.";
      if (!email.trim()) return "Email is required.";
      if (!phone.trim()) return "Phone is required.";
    }
    if (s === 1) {
      if (!typeId) return "Choose a trade.";
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
    setMessage(null);
    const payload: ContractorInput = {
      name,
      email,
      phone,
      contractorTypeId: typeId,
      aboutSection: about,
      businessHours: hours,
      serviceIds: serviceIds.filter((id) => typeServices.some((s) => s.id === id)),
      isPro,
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
    // Enter advances steps only — never creates via implicit submit.
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
        </section>
      )}

      {(!isCreate || step === 1) && (
        <section className="flex flex-col gap-6">
          {isCreate && <StepTitle title="Trade & services" subtitle="What work do they take?" />}
          <div>
            <Label htmlFor="type">Trade</Label>
            <Select
              id="type"
              className="h-14 text-lg"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <option value="" disabled>
                Choose a trade
              </option>
              {contractorTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Services offered</Label>
            <div className="flex flex-col gap-2">
              {typeServices.length === 0 && (
                <p className="text-sm text-text-muted">Choose a trade to see its services.</p>
              )}
              {typeServices.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-tap items-center gap-3 rounded-sm border border-border px-4 py-3"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  <span className="text-base text-text">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      {(!isCreate || step === 2) && (
        <section className="flex flex-col gap-6">
          {isCreate && <StepTitle title="Profile" subtitle="Optional details landowners may see." />}
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
              placeholder="A short description landowners will see."
            />
          </div>
          <label className="flex min-h-tap items-center gap-3 rounded-sm border border-border px-4 py-3">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={isPro}
              onChange={(e) => setIsPro(e.target.checked)}
            />
            <span className="text-base text-text">Pro contractor</span>
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
            size="lg"
            onClick={() => setStep((s) => s - 1)}
            disabled={pending}
          >
            Back
          </Button>
        )}
        {isCreate && step < STEPS.length - 1 ? (
          <Button type="button" variant="accent" size="lg" onClick={goNext}>
            Continue
          </Button>
        ) : (
          <Button type="button" variant="accent" size="lg" loading={pending} disabled={pending} onClick={save}>
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
