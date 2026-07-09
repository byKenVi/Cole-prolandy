"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type RevenuePoint = { label: string; revenueCents: number };
export type RevenueRanges = { d30: RevenuePoint[]; d90: RevenuePoint[]; y1: RevenuePoint[] };

const RANGES: { key: keyof RevenueRanges; label: string }[] = [
  { key: "d30", label: "30d" },
  { key: "d90", label: "90d" },
  { key: "y1", label: "1y" },
];

/**
 * Lead-revenue area chart with a 30d / 90d / 1y range toggle. All three series
 * are computed server-side from real accepted-lead charges (WalletTransaction
 * LEAD_CHARGE) and passed in; the toggle just switches which one is drawn.
 * Coloured with the gold accent token so it works in both admin themes.
 */
export function RevenueChart({ ranges }: { ranges: RevenueRanges }) {
  const [range, setRange] = useState<keyof RevenueRanges>("d30");
  const data = ranges[range];
  const hasData = data.some((d) => d.revenueCents > 0);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 3px",
              font: "600 13px/1 'Inter'",
              letterSpacing: ".03em",
              textTransform: "uppercase",
              color: "var(--ink2)",
            }}
          >
            Lead revenue
          </p>
          <p style={{ margin: 0, color: "var(--ink3)", fontSize: 13 }}>
            Accepted-lead charges over the selected window.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 3,
            background: "var(--card2)",
            border: "1px solid var(--line)",
            padding: 3,
            borderRadius: 9,
          }}
        >
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                style={{
                  cursor: "pointer",
                  border: "none",
                  font: "600 12px/1 'Inter'",
                  color: active ? "#fff" : "var(--ink2)",
                  background: active ? "var(--gold)" : "transparent",
                  padding: "6px 10px",
                  borderRadius: 6,
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasData ? (
        <div style={{ height: 240, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--ink3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
                tick={{ fontSize: 11, fill: "var(--ink3)" }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value) => [`$${(Number(value ?? 0) / 100).toFixed(2)}`, "Revenue"]}
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--ink)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenueCents"
                stroke="var(--gold)"
                strokeWidth={2.6}
                fill="url(#revenueFill)"
                dot={false}
                activeDot={{ r: 4.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            height: 240,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            background: "var(--card2)",
            color: "var(--ink3)",
            fontSize: 14,
          }}
        >
          No revenue yet — accepted leads will show up here.
        </div>
      )}
    </div>
  );
}
