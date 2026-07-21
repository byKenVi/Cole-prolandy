"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfile } from "@/app/actions/onboarding";
import { BusinessHoursPicker } from "@/components/business-hours-picker";

/**
 * Contractor self-service profile editor.
 * Project assignment is read-only here — Landy's assigns projects.
 */
export function OnboardingForm({
  initial,
  assignedProjects,
  mode = "edit",
}: {
  initial: {
    name: string;
    phone: string;
    aboutSection: string;
    businessHours: string;
  };
  /** Admin-assigned projects this contractor receives leads for. */
  assignedProjects: { id: string; name: string }[];
  mode?: "edit" | "claim";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [about, setAbout] = useState(initial.aboutSection);
  const [hours, setHours] = useState(initial.businessHours);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveProfile({
        name,
        phone,
        aboutSection: about,
        businessHours: hours,
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
        <Label>Jobs you receive leads for</Label>
        {assignedProjects.length === 0 ? (
          <p className="mt-2 rounded-[12px] border border-[#EBE3D4] bg-[#F7F0E3] px-3 py-3 text-sm text-[#8A7E68]">
            No projects assigned yet. Contact Landy’s to get set up.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {assignedProjects.map((p) => (
              <li
                key={p.id}
                className="rounded-full border border-[#E6DFD1] bg-[#FEFBF6] px-3 py-1.5 text-[13px] font-medium text-[#5A4E3E]"
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[13px] text-[#8A7E68]">
          To change the jobs you receive, contact Landy’s.
        </p>
      </div>

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
        <Label>Business hours</Label>
        <div className="mt-2">
          <BusinessHoursPicker value={hours} onChange={setHours} />
        </div>
      </div>

      <div>
        <Label htmlFor="about">About your business</Label>
        <Textarea
          id="about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="A short description for your contractor profile."
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
        {mode === "claim" ? "Claim profile" : "Save profile"}
      </Button>
    </form>
  );
}
