import Link from "next/link";

export type RevenueRange = "7d" | "30d" | "90d" | "all";
export type RevenuePoint = { label: string; revenueCents: number };

const RANGE_OPTIONS: { id: RevenueRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "all", label: "All" },
];

/**
 * Success-fees-collected hero with an interactive Recharts sparkline.
 * Series is PAID SuccessFee totals (server-computed, zero-filled).
 */
export function RevenueHero({
  value,
  trend,
  series,
  range,
}: {
  value: string;
  trend: number | null;
  series: RevenuePoint[];
  range: RevenueRange;
}) {
  const chartData = series.map((p) => ({
    label: p.label,
    revenueCents: p.revenueCents,
  }));
  const chartWidth = 1000;
  const chartHeight = 96;
  const topPadding = 8;
  const bottomPadding = 8;
  const maxRevenue = Math.max(1, ...chartData.map((point) => point.revenueCents));
  const points = chartData.map((point, index) => {
    const x =
      chartData.length <= 1 ? chartWidth / 2 : (index / (chartData.length - 1)) * chartWidth;
    const y =
      chartHeight -
      bottomPadding -
      (point.revenueCents / maxRevenue) * (chartHeight - topPadding - bottomPadding);
    return { ...point, x, y };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1]!.x.toFixed(1)},${chartHeight} L${points[0]!.x.toFixed(1)},${chartHeight} Z`
    : "";
  const firstLabel = chartData[0]?.label ?? "";
  const middleLabel = chartData[Math.floor(chartData.length / 2)]?.label ?? "";
  const lastLabel = chartData[chartData.length - 1]?.label ?? "";

  const rangeLabel = RANGE_OPTIONS.find((o) => o.id === range)?.label ?? "30D";

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
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <p
              style={{
                margin: 0,
                font: "600 11px/1 var(--mono)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "rgba(241,231,214,.62)",
              }}
            >
              Success fees collected · {rangeLabel}
            </p>
            <div
              role="tablist"
              aria-label="Success fees period"
              style={{
                display: "inline-flex",
                flexWrap: "wrap",
                gap: 4,
                padding: 3,
                borderRadius: 999,
                background: "rgba(0,0,0,.18)",
              }}
            >
              {RANGE_OPTIONS.map((opt) => {
                const active = opt.id === range;
                return (
                  <Link
                    key={opt.id}
                    href={opt.id === "30d" ? "/admin" : `/admin?range=${opt.id}`}
                    role="tab"
                    aria-selected={active}
                    scroll={false}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: 34,
                      padding: "0 12px",
                      borderRadius: 999,
                      font: "600 11px/1 'Inter'",
                      textDecoration: "none",
                      color: active ? "#2F4A3C" : "rgba(241,231,214,.78)",
                      background: active ? "#E0A95C" : "transparent",
                    }}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <p
            style={{
              margin: "0 0 6px",
              fontFamily: "var(--display)",
              fontWeight: 600,
              fontSize: "clamp(32px, 9vw, 48px)",
              lineHeight: 1,
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

      <div
        role="img"
        aria-label={`Success fees collected over ${rangeLabel}: ${value}`}
        style={{ width: "100%", marginTop: 14 }}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width="100%"
          height="112"
          preserveAspectRatio="none"
          aria-hidden
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="heroRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E0A95C" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#E0A95C" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              x1="0"
              x2={chartWidth}
              y1={chartHeight * fraction}
              y2={chartHeight * fraction}
              stroke="rgba(241,231,214,.10)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {areaPath && <path d={areaPath} fill="url(#heroRevenueFill)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#E0A95C"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 4,
            color: "rgba(241,231,214,.5)",
            font: "500 10px/1 var(--mono)",
          }}
        >
          <span>{firstLabel}</span>
          <span>{middleLabel}</span>
          <span>{lastLabel}</span>
        </div>
      </div>
    </div>
  );
}
