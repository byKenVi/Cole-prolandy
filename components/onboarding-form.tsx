"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { saveProfile } from "@/app/actions/onboarding";
import { cn } from "@/lib/utils";

type Svc = { id: string; name: string; contractorTypeId: string };

export function OnboardingForm({
  initial,
  contractorTypes,
  services,
}: {
  initial: {
    name: string;
    phone: string;
    contractorTypeId: string;
    aboutSection: string;
    businessHours: string;
    serviceIds: string[];
  };
  contractorTypes: { id: string; name: string }[];
  services: Svc[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [typeId, setTypeId] = useState(initial.contractorTypeId);
  const [about, setAbout] = useState(initial.aboutSection);
  const [hours, setHours] = useState(initial.businessHours);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds);

  const typeServices = useMemo(
    () => services.filter((s) => s.contractorTypeId === typeId),
    [services, typeId],
  );

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveProfile({
        name,
        phone,
        contractorTypeId: typeId,
        aboutSection: about,
        businessHours: hours,
        serviceIds: serviceIds.filter((id) => typeServices.some((s) => s.id === id)),
      });
      if (res.ok) {
        setSaved(true);
        if (res.created) router.push("/home");
        else router.refresh();
      } else {
        setMessage(res.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="name">Business / your name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <Label htmlFor="phone">Phone (for lead texts)</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="type">Your trade</Label>
        <Select id="type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {contractorTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Services you offer</Label>
        <div className="flex flex-col gap-2">
          {typeServices.length === 0 && (
            <p className="text-sm text-text-muted">No services listed for this trade.</p>
          )}
          {typeServices.map((s) => {
            const checked = serviceIds.includes(s.id);
            return (
              <label
                key={s.id}
                className={cn(
                  "flex min-h-tap cursor-pointer items-center gap-3 rounded-sm border px-3 py-3 transition-colors",
                  checked
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:bg-primary-soft",
                )}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--color-primary)]"
                  checked={checked}
                  onChange={() => toggleService(s.id)}
                />
                <span className="text-base text-text">{s.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="hours">Business hours</Label>
        <Input
          id="hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Mon–Fri 7am–6pm"
        />
      </div>

      <div>
        <Label htmlFor="about">About your business</Label>
        <Textarea
          id="about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="A short description landowners will see."
        />
      </div>

      {message && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{message}</p>
      )}
      {saved && (
        <p className="rounded-sm bg-success-soft p-3 text-sm font-medium text-success">
          Profile saved.
        </p>
      )}

      <Button type="submit" variant="accent" size="cta" loading={pending} disabled={pending}>
        Save profile
      </Button>
    </form>
  );
}
