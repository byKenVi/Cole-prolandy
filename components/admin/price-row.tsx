"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePriceTier } from "@/app/actions/admin";
import { centsToDollars, dollarsToCents } from "@/lib/money";

type Tier = { id: string; tier: number; priceCents: number };

export function PriceRow({
  projectTypeName,
  tiers,
}: {
  projectTypeName: string;
  tiers: Tier[];
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(sorted.map((t) => [t.id, String(centsToDollars(t.priceCents))])),
  );

  function save() {
    setStatus(null);
    startTransition(async () => {
      const changed = sorted.filter(
        (t) => dollarsToCents(values[t.id]) !== t.priceCents,
      );
      for (const t of changed) {
        const res = await updatePriceTier(t.id, dollarsToCents(values[t.id]));
        if (!res.ok) {
          setStatus(res.message);
          return;
        }
      }
      setStatus(changed.length ? "Saved" : "No changes");
    });
  }

  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-3 text-sm text-text">{projectTypeName}</td>
      {sorted.map((t) => (
        <td key={t.id} className="px-2 py-2">
          <div className="flex items-center">
            <span className="text-sm text-text-muted">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              className="h-10 w-24"
              value={values[t.id]}
              onChange={(e) => setValues((v) => ({ ...v, [t.id]: e.target.value }))}
            />
          </div>
        </td>
      ))}
      <td className="py-2 pl-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="brand" onClick={save} loading={pending} disabled={pending}>
            Save
          </Button>
          {status && <span className="text-xs text-text-muted">{status}</span>}
        </div>
      </td>
    </tr>
  );
}
