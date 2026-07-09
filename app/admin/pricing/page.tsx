import { prisma } from "@/lib/prisma";
import { PricingGroup } from "@/components/admin/pricing-group";
import { formatMoney } from "@/lib/money";
import { iconSrcFor } from "@/lib/project-icons";

export const dynamic = "force-dynamic";

const TIER_LEGEND = [
  { bars: 1, title: "Tier 1 · Small jobs", desc: "Quick, single-visit work" },
  { bars: 2, title: "Tier 2 · Standard", desc: "Typical multi-day projects" },
  { bars: 3, title: "Tier 3 · Large / complex", desc: "High-value, involved jobs" },
];

export default async function PricingPage() {
  const types = await prisma.contractorType.findMany({
    orderBy: { name: "asc" },
    include: {
      projectTypes: {
        orderBy: { name: "asc" },
        include: { priceTiers: true },
      },
    },
  });

  const allTiers = types.flatMap((t) => t.projectTypes.flatMap((p) => p.priceTiers));
  const avgCents =
    allTiers.length > 0
      ? Math.round(allTiers.reduce((s, t) => s + t.priceCents, 0) / allTiers.length)
      : 0;

  return (
    <div className="admin-fade-up">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 22,
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h1
            className="font-fraunces"
            style={{ fontWeight: 600, fontSize: 34, letterSpacing: "-.01em", margin: 0, color: "var(--ink)" }}
          >
            Pricing matrix
          </h1>
          <p style={{ margin: "8px 0 0", color: "var(--ink2)", fontSize: 15, lineHeight: 1.6 }}>
            What a contractor pays for a lead, set per{" "}
            <b style={{ color: "var(--ink)" }}>trade × project × tier</b>. Edits apply to new leads
            only — existing leads keep their snapshotted price.
          </p>
        </div>
        <div
          style={{
            flex: "none",
            background: "var(--sage)",
            borderRadius: 16,
            padding: "16px 20px",
            minWidth: 200,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              font: "600 11px/1 'Inter'",
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
              font: "600 28px/1 'Inter'",
              color: "var(--sageFg)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatMoney(avgCents)}
          </p>
        </div>
      </div>

      {/* tier legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        {TIER_LEGEND.map((t) => (
          <div
            key={t.title}
            style={{
              flex: 1,
              minWidth: 210,
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "15px 18px",
              boxShadow: "var(--shadow)",
              display: "flex",
              alignItems: "center",
              gap: 13,
            }}
          >
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
          No pricing configured. Seed the database to populate the matrix.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {types.map((ct) => (
            <PricingGroup
              key={ct.id}
              name={ct.name}
              sub={`${ct.projectTypes.length} project type${ct.projectTypes.length === 1 ? "" : "s"}`}
              iconSrc={iconSrcFor({ icon: ct.icon, category: ct.name })}
              rows={ct.projectTypes.map((pt) => ({
                projectTypeId: pt.id,
                name: pt.name,
                tiers: pt.priceTiers.map((t) => ({
                  id: t.id,
                  tier: t.tier,
                  priceCents: t.priceCents,
                })),
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
