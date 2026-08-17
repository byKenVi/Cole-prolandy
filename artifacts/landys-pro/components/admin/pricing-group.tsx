"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { updatePriceTier } from "@/app/actions/admin";
import { centsToDollars, dollarsToCents, formatMoney } from "@/lib/money";

type Tier = {
  id: string;
  tier: number;
  priceCents: number;
  maxBudgetCents: number | null;
};
type Row = { projectTypeId: string; name: string; tiers: Tier[] };

export function PricingGroup({
  name,
  sub,
  iconSrc,
  rows,
}: {
  name: string;
  sub: string;
  iconSrc: string | null;
  rows: Row[];
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const original = useMemo(() => {
    const prices: Record<string, string> = {};
    const budgets: Record<string, string> = {};
    for (const r of rows) {
      for (const t of r.tiers) {
        prices[t.id] = String(centsToDollars(t.priceCents));
        budgets[t.id] =
          t.maxBudgetCents != null ? String(centsToDollars(t.maxBudgetCents)) : "";
      }
    }
    return { prices, budgets };
  }, [rows]);

  const [prices, setPrices] = useState<Record<string, string>>(original.prices);
  const [budgets, setBudgets] = useState<Record<string, string>>(original.budgets);

  function save() {
    setMessage(null);
    startTransition(async () => {
      for (const r of rows) {
        for (const tier of r.tiers) {
          const priceChanged =
            dollarsToCents(prices[tier.id]) !== dollarsToCents(original.prices[tier.id]);
          const budgetChanged =
            tier.tier < 3 &&
            dollarsToCents(budgets[tier.id] ?? "0") !==
              dollarsToCents(original.budgets[tier.id] ?? "0");
          if (!priceChanged && !budgetChanged) continue;

          const maxBudgetCents =
            tier.tier < 3 ? dollarsToCents(budgets[tier.id] ?? "0") : undefined;
          const res = await updatePriceTier(
            tier.id,
            dollarsToCents(prices[tier.id]),
            maxBudgetCents,
          );
          if (!res.ok) {
            setStatus("error");
            setMessage(res.message);
            return;
          }
        }
      }
      setStatus("saved");
      setMessage("Saved");
      setTimeout(() => setStatus("idle"), 1800);
    });
  }

  const tier1 = rows[0]?.tiers.find((t) => t.tier === 1);
  const tier2 = rows[0]?.tiers.find((t) => t.tier === 2);

  return (
    <div
      className="pricing-group"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 18,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div className="pricing-group-head">
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              background: "var(--card2)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            {iconSrc ? (
              <Image src={iconSrc} alt="" width={28} height={28} style={{ objectFit: "contain" }} />
            ) : null}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, font: "600 17px/1.2 'Inter'", color: "var(--ink)" }}>{name}</p>
            <p style={{ margin: "4px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
              {sub}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            minHeight: 44,
            padding: "0 18px",
            background: "var(--sageFg)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            font: "600 13px/1 'Inter'",
            cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Saving…" : status === "saved" ? "Saved" : "Save changes"}
        </button>
      </div>

      {message && (
        <p
          style={{
            padding: "0 20px 8px",
            font: "500 12px/1.4 'Inter'",
            color: status === "error" ? "var(--danger)" : "var(--sageFg)",
          }}
        >
          {message}
        </p>
      )}

      <div className="pricing-group-body" style={{ padding: "0 20px 20px" }}>
        {[1, 2, 3].map((tierNum) => {
          const tier = rows[0]?.tiers.find((t) => t.tier === tierNum);
          if (!tier) return null;
          const t1Max = tier1 ? dollarsToCents(budgets[tier1.id] ?? "0") : 0;
          const t2Max = tier2 ? dollarsToCents(budgets[tier2.id] ?? "0") : 0;
          const range =
            tierNum === 1
              ? `Up to ${formatMoney(t1Max)}`
              : tierNum === 2
                ? `${formatMoney(t1Max + 1)} – ${formatMoney(t2Max)}`
                : `Above ${formatMoney(t2Max)}`;

          return (
            <div
              key={tierNum}
              style={{
                borderTop: "1px solid var(--line)",
                paddingTop: 16,
                marginTop: 16,
                display: "grid",
                gap: 10,
              }}
            >
              <p style={{ margin: 0, font: "600 14px/1.3 'Inter'", color: "var(--ink)" }}>
                Tier {tierNum}
              </p>
              <p style={{ margin: 0, font: "400 12px/1.4 'Inter'", color: "var(--ink3)" }}>
                Project budget: {range}
              </p>
              <label style={{ font: "600 11px/1 'Inter'", color: "var(--ink3)" }}>
                Lead price
                <input
                  value={prices[tier.id] ?? ""}
                  onChange={(e) =>
                    setPrices((s) => ({ ...s, [tier.id]: e.target.value.replace(/[^0-9.]/g, "") }))
                  }
                  style={{
                    display: "block",
                    marginTop: 6,
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    borderRadius: 10,
                    border: "1px solid var(--fieldLine)",
                  }}
                />
              </label>
              {tierNum < 3 && (
                <label style={{ font: "600 11px/1 'Inter'", color: "var(--ink3)" }}>
                  Max project budget
                  <input
                    value={budgets[tier.id] ?? ""}
                    onChange={(e) =>
                      setBudgets((s) => ({
                        ...s,
                        [tier.id]: e.target.value.replace(/[^0-9.]/g, ""),
                      }))
                    }
                    style={{
                      display: "block",
                      marginTop: 6,
                      width: "100%",
                      height: 42,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: "1px solid var(--fieldLine)",
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
