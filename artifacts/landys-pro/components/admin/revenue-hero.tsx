import Link from "next/link";

export type RevenueRange = "7d" | "30d" | "90d" | "all";
export type RevenuePoint = { label: string; revenueCents: number };

const RANGE_OPTIONS: { id: RevenueRange; label: string; sentence: string }[] = [
  { id: "7d", label: "7 days", sentence: "in the last 7 days" },
  { id: "30d", label: "30 days", sentence: "in the last 30 days" },
  { id: "90d", label: "90 days", sentence: "in the last 90 days" },
  { id: "all", label: "All time", sentence: "since launch" },
];

/**
 * Success fees collected over a period: the amount, how many fees it comes
 * from, and one bar per day (or per month for long histories). Bars, not an
 * area: fees land on specific days, and an empty day should look empty.
 */
export function RevenueHero({
  value,
  paidCount,
  series,
  range,
}: {
  value: string;
  paidCount: number;
  series: RevenuePoint[];
  range: RevenueRange;
}) {
  const option = RANGE_OPTIONS.find((o) => o.id === range) ?? RANGE_OPTIONS[1]!;
  const chartWidth = 1000;
  const chartHeight = 120;
  const max = Math.max(1, ...series.map((p) => p.revenueCents));
  const slot = chartWidth / Math.max(1, series.length);
  const barWidth = Math.max(2, Math.min(28, slot * 0.62));
  const firstLabel = series[0]?.label ?? "";
  const middleLabel = series[Math.floor(series.length / 2)]?.label ?? "";
  const lastLabel = series[series.length - 1]?.label ?? "";

  return (
    <section
      aria-label="Success fees collected"
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--card)",
        padding: "18px 20px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, font: "600 17px/1.2 var(--head)", color: "var(--ink)" }}>Success fees collected</h2>
          <p style={{ margin: "10px 0 0", font: "700 40px/1 var(--head)", color: "var(--ink)" }}>{value}</p>
          <p style={{ margin: "8px 0 0", font: "400 14px/1.4 var(--ui)", color: "var(--ink2)" }}>
            {paidCount === 0
              ? `No fee paid ${option.sentence}.`
              : `${paidCount} fee${paidCount === 1 ? "" : "s"} paid ${option.sentence}.`}
          </p>
        </div>
        <nav
          aria-label="Period"
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            gap: 2,
            padding: 3,
            borderRadius: 9,
            background: "var(--card2)",
            border: "1px solid var(--line)",
          }}
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = opt.id === range;
            return (
              <Link
                key={opt.id}
                href={opt.id === "30d" ? "/admin" : `/admin?range=${opt.id}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 32,
                  padding: "0 12px",
                  borderRadius: 7,
                  font: `${active ? 600 : 500} 13px/1 var(--ui)`,
                  textDecoration: "none",
                  color: active ? "var(--ink)" : "var(--ink2)",
                  background: active ? "var(--card)" : "transparent",
                  border: active ? "1px solid var(--line)" : "1px solid transparent",
                }}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div role="img" aria-label={`${value} collected ${option.sentence}`} style={{ marginTop: 18 }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width="100%"
          height="120"
          preserveAspectRatio="none"
          aria-hidden
          style={{ display: "block" }}
        >
          <line
            x1="0"
            x2={chartWidth}
            y1={chartHeight - 0.5}
            y2={chartHeight - 0.5}
            stroke="var(--line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {series.map((point, index) => {
            if (point.revenueCents <= 0) return null;
            const h = Math.max(3, (point.revenueCents / max) * (chartHeight - 6));
            const x = index * slot + (slot - barWidth) / 2;
            return (
              <rect
                key={index}
                x={x}
                y={chartHeight - h}
                width={barWidth}
                height={h}
                rx={Math.min(3, barWidth / 3)}
                fill="var(--gold)"
              />
            );
          })}
        </svg>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 6,
            color: "var(--ink3)",
            font: "500 12px/1 var(--ui)",
          }}
        >
          <span>{firstLabel}</span>
          <span>{middleLabel}</span>
          <span>{lastLabel}</span>
        </div>
      </div>
    </section>
  );
}
