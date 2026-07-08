"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

type ProjectType = { id: string; name: string; contractorTypeName: string };

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

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    location: "",
    projectTypeId: projectTypes[0]?.id ?? "",
    landTypeId: "",
    description: "",
    company: "", // honeypot
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="font-display text-2xl font-semibold text-text">Request received</p>
        <p className="max-w-sm text-base text-text-muted">
          Your request has been sent to our contractors — they&apos;ll reach out to you soon. No need
          to do anything else.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
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

      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="location">Property location</Label>
        <Input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="City, State" required />
      </div>
      <div>
        <Label htmlFor="project">What do you need done?</Label>
        <Select id="project" value={form.projectTypeId} onChange={(e) => set("projectTypeId", e.target.value)}>
          {projectTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.contractorTypeName} — {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="land">Type of land (optional)</Label>
        <Select id="land" value={form.landTypeId} onChange={(e) => set("landTypeId", e.target.value)}>
          <option value="">—</option>
          {landTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="desc">Anything else? (optional)</Label>
        <Textarea id="desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe your project" />
      </div>

      {error && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
      )}

      <Button type="submit" variant="accent" size="cta" loading={submitting} disabled={submitting}>
        Get my free estimate
      </Button>
    </form>
  );
}
