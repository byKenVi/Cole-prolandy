"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; label: string; revenueCents: number };

export function RevenueChart({ data }: { data: Point[] }) {
  const hasData = data.some((d) => d.revenueCents > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md bg-primary-soft text-sm text-text-muted">
        No revenue yet — accepted leads will show up here.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value) => [`$${(Number(value ?? 0) / 100).toFixed(2)}`, "Revenue"]}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="revenueCents"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
