import { prisma } from "@/lib/prisma";
import { PricingBrowser } from "@/components/admin/pricing-browser";
import { formatMoney } from "@/lib/money";
import { iconSrcFor } from "@/lib/project-icons";

export const dynamic = "force-dynamic";

const TIER_LEGEND = [
  { bars: 1, title: "Tier 1 · Small jobs", desc: "Quick, single-visit work" },
  { bars: 2, title: "Tier 2 · Standard", desc: "Typical multi-day projects" },
  { bars: 3, title: "Tier 3 · Large / complex", desc: "High-value, involved jobs" },
];

export default async function PricingPage() {
  // One group per project, with exactly three database-backed tier prices.
  const types = await prisma.contractorType.findMany({
    orderBy: { name: "asc" },
    include: {
      projectType: {
        include: { priceTiers: true },
      },
    },
  });

  const allTiers = types.flatMap((t) => t.projectType?.priceTiers ?? []);
  const avgCents =
    allTiers.length > 0
      ? Math.round(allTiers.reduce((s, t) => s + t.priceCents, 0) / allTiers.length)
      : 0;

  return (
    <div className="admin-fade-up pricing-page">
      <div className="pricing-page-header">
        <div className="pricing-page-intro">
          <p
            style={{
              margin: "0 0 8px",
              font: "600 12px/1 var(--mono)",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--gold)",
            }}
          >
            Lead pricing
          </p>
          <h1 className="pricing-page-title font-fraunces">Pricing matrix</h1>
          <p className="pricing-page-sub">
            What a contractor pays for a lead, set per{" "}
            <b style={{ color: "var(--ink)" }}>project × tier</b>. Each project has exactly three
            tiers (small / medium / large). Edits apply to new leads only — existing leads keep their
            snapshotted price.
          </p>
        </div>
        <div className="pricing-avg-card">
          <p
            style={{
              margin: "0 0 6px",
              font: "600 11px/1 var(--mono)",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--sageFg)",
              opacity: 0.85,
            }}
          >
            Avg lead price
          </p>
          <p
            style={{
              margin: 0,
              font: "600 28px/1 var(--display)",
              color: "var(--sageFg)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatMoney(avgCents)}
          </p>
        </div>
      </div>

      <div className="pricing-tier-legend">
        {TIER_LEGEND.map((t) => (
          <div key={t.title} className="pricing-tier-legend-card">
            <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 26 }}>
              {[11, 19, 26].slice(0, t.bars).map((h, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: h,
                    background: "var(--gold)",
                    borderRadius: 2,
                    opacity: t.bars === 1 ? 1 : [0.4, 0.65, 1][i],
                  }}
                />
              ))}
            </span>
            <div>
              <p style={{ margin: 0, font: "600 14px/1 'Inter'", color: "var(--ink)" }}>{t.title}</p>
              <p style={{ margin: "4px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                {t.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {types.length === 0 ? (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: "40px 24px",
            textAlign: "center",
            color: "var(--ink3)",
          }}
        >
          No pricing configured. Create a project and enter its three prices in Admin Settings.
        </div>
      ) : (
        <PricingBrowser
          groups={types
            .map((ct) => {
              const pt = ct.projectType;
              if (!pt) return null;
              return {
                id: ct.id,
                name: ct.name,
                sub: "3 tiers · Project → Tier",
                iconSrc: iconSrcFor({ icon: ct.icon, category: ct.name }),
                rows: [
                  {
                    projectTypeId: pt.id,
                    name: "Lead price by scale",
                    tiers: pt.priceTiers.map((t) => ({
                      id: t.id,
                      tier: t.tier,
                      priceCents: t.priceCents,
                    })),
                  },
                ],
              };
            })
            .filter((g): g is NonNullable<typeof g> => g != null)}
        />
      )}
    </div>
  );
}
