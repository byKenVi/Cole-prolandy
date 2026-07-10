"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RevenuePoint } from "@/components/admin/revenue-chart";
import { formatMoney } from "@/lib/money";

/**
 * Dark-green lead-revenue hero with an interactive Recharts sparkline.
 * Series is real daily LEAD_CHARGE totals (server-computed, zero-filled).
 */
export function RevenueHero({
  value,
  trend,
  series,
}: {
  value: string;
  trend: number | null;
  series: RevenuePoint[];
}) {
  const chartData = series.map((p) => ({
    label: p.label,
    revenueCents: p.revenueCents,
  }));

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "26px 28px 18px",
        background: "linear-gradient(150deg,var(--green),var(--green2))",
        color: "#F1E7D6",
        boxShadow: "var(--shadowMd)",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 10px",
              font: "600 11px/1 var(--mono)",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "rgba(241,231,214,.62)",
            }}
          >
            Lead revenue · 30 days
          </p>
          <p
            style={{
              margin: "0 0 6px",
              font: "600 48px/1 var(--display)",
              letterSpacing: "-.02em",
              color: "#F8F1E2",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </p>
          {typeof trend === "number" && (
            <p
              style={{
                margin: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                font: "600 13px/1 'Inter'",
                color: "#B9D0BC",
                background: "rgba(185,208,188,.14)",
                padding: "5px 10px",
                borderRadius: 999,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: trend < 0 ? "scaleY(-1)" : undefined }}
                aria-hidden
              >
                <path d="M4 17l7-7 4 4 5-6" />
              </svg>
              {Math.abs(trend)}% vs prior half
            </p>
          )}
        </div>
        <span
          aria-hidden
          style={{
            width: 92,
            height: 92,
            flex: "none",
            borderRadius: 999,
            background: "radial-gradient(circle at 35% 30%,#F0C27E,#C0803C 70%)",
            boxShadow: "0 10px 22px rgba(0,0,0,.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "700 34px/1 var(--display)",
            color: "#7A5320",
          }}
        >
          $
        </span>
      </div>

      <div style={{ width: "100%", height: 100, marginTop: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="heroRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E0A95C" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#E0A95C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ stroke: "rgba(241,231,214,.35)", strokeWidth: 1 }}
              formatter={(value) => [formatMoney(Number(value ?? 0)), "Revenue"]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid rgba(241,231,214,.2)",
                background: "#2F4A3C",
                color: "#F1E7D6",
                fontSize: 12,
                boxShadow: "0 8px 20px rgba(0,0,0,.35)",
              }}
              itemStyle={{ color: "#E0A95C" }}
              labelStyle={{ color: "rgba(241,231,214,.75)", marginBottom: 2 }}
            />
            <Area
              type="monotone"
              dataKey="revenueCents"
              stroke="#E0A95C"
              strokeWidth={2.8}
              fill="url(#heroRevenueFill)"
              dot={false}
              activeDot={{
                r: 5,
                fill: "#E0A95C",
                stroke: "#2F4A3C",
                strokeWidth: 2.5,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
