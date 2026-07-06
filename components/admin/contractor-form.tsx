"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createContractor, updateContractor, type ContractorInput } from "@/app/actions/admin";

type Svc = { id: string; name: string; contractorTypeId: string };

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

  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [typeId, setTypeId] = useState(initial.contractorTypeId);
  const [about, setAbout] = useState(initial.aboutSection ?? "");
  const [hours, setHours] = useState(initial.businessHours ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds);
  const [isPro, setIsPro] = useState(initial.isPro);

  const typeServices = useMemo(
    () => services.filter((s) => s.contractorTypeId === typeId),
    [services, typeId],
  );

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="name">Business / contractor name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <Label htmlFor="email">Email (used to link their login later)</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
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
        <Label htmlFor="type">Trade</Label>
        <Select id="type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
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
              className="flex min-h-tap items-center gap-3 rounded-sm border border-border px-3 py-2"
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
        <Label htmlFor="about">About the business</Label>
        <Textarea
          id="about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="A short description landowners will see."
        />
      </div>

      <label className="flex min-h-tap items-center gap-3 rounded-sm border border-border px-3 py-2">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={isPro}
          onChange={(e) => setIsPro(e.target.checked)}
        />
        <span className="text-base text-text">Pro contractor</span>
      </label>

      {message && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{message}</p>
      )}

      <Button type="submit" variant="accent" size="cta" loading={pending} disabled={pending}>
        {mode === "create" ? "Create contractor" : "Save changes"}
      </Button>
    </form>
  );
}
