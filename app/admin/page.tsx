import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { RevenueChart, type RevenuePoint, type RevenueRanges } from "@/components/admin/revenue-chart";
import { PageHeader, GoldButtonLink, Panel, StatCard, IconTile, Chip } from "@/components/admin/ui";
import { RowLink } from "@/components/admin/row-link";
import { formatMoney } from "@/lib/money";
import { iconSrcFor } from "@/lib/project-icons";
import { formatDate } from "@/lib/format";
import { leadStatusChip } from "@/lib/admin-display";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning, Admin";
  if (h < 18) return "Good afternoon, Admin";
  return "Good evening, Admin";
}

export default async function AdminDashboard() {
  await expireLeads(prisma).catch(() => undefined);

  const now = new Date();
  const start365 = new Date();
  start365.setHours(0, 0, 0, 0);
  start365.setDate(start365.getDate() - 364);

  const [
    contractors,
    proContractors,
    openLeads,
    pendingMatches,
    acceptedMatches,
    expiredMatches,
    walletAgg,
    charges,
    recentLeads,
  ] = await Promise.all([
    prisma.contractor.count(),
    prisma.contractor.count({ where: { isPro: true } }),
    prisma.lead.count({ where: { status: { in: ["NEW", "DISTRIBUTED"] } } }),
    prisma.leadMatch.count({ where: { status: "PENDING" } }),
    prisma.leadMatch.count({ where: { status: "ACCEPTED" } }),
    prisma.leadMatch.count({ where: { status: "EXPIRED" } }),
    prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
    prisma.walletTransaction.findMany({
      where: { type: "LEAD_CHARGE", createdAt: { gte: start365 } },
      select: { amountCents: true, createdAt: true },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        priceCents: true,
        createdAt: true,
        projectType: {
          select: { name: true, contractorType: { select: { name: true, icon: true } } },
        },
      },
    }),
  ]);

  const walletFloat = walletAgg._sum.walletBalanceCents ?? 0;

  // Bucket LEAD_CHARGE (stored negative) into daily/monthly windows in JS from a
  // single query, zero-filled so lines are continuous.
  const dailyKey = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  };
  const byDay = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const c of charges) {
    const day = dailyKey(c.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(c.amountCents));
    const month = c.createdAt.toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + Math.abs(c.amountCents));
  }

  const dailySeries = (days: number): RevenuePoint[] => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - (days - 1));
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return {
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenueCents: byDay.get(dailyKey(d)) ?? 0,
      };
    });
  };

  const monthlySeries = (): RevenuePoint[] => {
    const arr: RevenuePoint[] = [];
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      arr.push({
        label: d.toLocaleDateString(undefined, { month: "short" }),
        revenueCents: byMonth.get(d.toISOString().slice(0, 7)) ?? 0,
      });
    }
    return arr;
  };

  const d30 = dailySeries(30);
  const ranges: RevenueRanges = { d30, d90: dailySeries(90), y1: monthlySeries() };

  const revenue30 = d30.reduce((s, p) => s + p.revenueCents, 0);
  // Honest trend: second half vs first half of the 30d window.
  const firstHalf = d30.slice(0, 15).reduce((s, p) => s + p.revenueCents, 0);
  const secondHalf = d30.slice(15).reduce((s, p) => s + p.revenueCents, 0);
  const trendPct =
    firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : null;

  const pipelineTotal = acceptedMatches + pendingMatches + expiredMatches;
  const pct = (n: number) => (pipelineTotal > 0 ? (n / pipelineTotal) * 100 : 0);
  const acceptanceRate = pipelineTotal > 0 ? Math.round((acceptedMatches / pipelineTotal) * 100) : 0;

  const dateStr = now.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="admin-fade-up">
      <PageHeader
        title={greeting()}
        subtitle={`Your marketplace at a glance — ${dateStr}.`}
        action={<GoldButtonLink href="/admin/leads/new">New lead</GoldButtonLink>}
      />

      {/* KPI ROW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 1.15fr 1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <SageStat label="Lead revenue · 30d" value={formatMoney(revenue30)} trend={trendPct} />
        <SageStat label="Wallet float" value={formatMoney(walletFloat)} />
        <StatCard label="Open leads" value={String(openLeads)} sub={`${pendingMatches} awaiting a match`} />
        <StatCard label="Contractors" value={String(contractors)} sub={`${proContractors} on Pro plan`} />
      </div>

      {/* CHART + PIPELINE */}
      <div style={{ display: "grid", gridTemplateColumns: "1.75fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel style={{ padding: "24px 26px" }}>
          <RevenueChart ranges={ranges} />
        </Panel>

        <Panel style={{ padding: "24px 26px" }}>
          <p
            style={{
              margin: "0 0 3px",
              font: "600 13px/1 'Inter'",
              letterSpacing: ".03em",
              textTransform: "uppercase",
              color: "var(--ink2)",
            }}
          >
            Match pipeline
          </p>
          <p style={{ margin: "0 0 20px", color: "var(--ink3)", fontSize: 13 }}>
            {pipelineTotal} match{pipelineTotal === 1 ? "" : "es"} this period.
          </p>
          <div
            style={{
              display: "flex",
              height: 14,
              borderRadius: 999,
              overflow: "hidden",
              marginBottom: 22,
              background: "var(--track)",
            }}
          >
            <div style={{ width: `${pct(acceptedMatches)}%`, background: "var(--gold)" }} />
            <div style={{ width: `${pct(pendingMatches)}%`, background: "#D8B577" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PipelineRow color="var(--gold)" label="Accepted" value={acceptedMatches} />
            <PipelineRow color="#D8B577" label="Pending" value={pendingMatches} />
            <PipelineRow
              color="var(--track)"
              border
              label="Expired"
              value={expiredMatches}
              muted
            />
          </div>
          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ font: "500 13px/1 'Inter'", color: "var(--ink2)" }}>Acceptance rate</span>
            <span
              style={{
                font: "600 20px/1 'Inter'",
                color: "var(--sageFg)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {acceptanceRate}%
            </span>
          </div>
        </Panel>
      </div>

      {/* RECENT LEADS */}
      <Panel style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <p style={{ margin: 0, font: "600 15px/1 'Inter'", color: "var(--ink)" }}>Recent leads</p>
          <a
            href="/admin/leads"
            className="a-linkgold"
            style={{
              font: "600 13px/1 'Inter'",
              color: "var(--gold)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              textDecoration: "none",
            }}
          >
            View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        {recentLeads.length === 0 ? (
          <p style={{ padding: "24px", color: "var(--ink3)", fontSize: 14 }}>No leads yet.</p>
        ) : (
          recentLeads.map((lead) => {
            const chip = leadStatusChip(lead.status);
            const src = iconSrcFor({
              icon: lead.projectType.contractorType.icon,
              category: lead.projectType.contractorType.name,
              project: lead.projectType.name,
            });
            return (
              <div
                key={lead.id}
                className="a-row"
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "44px 1.8fr 1.4fr auto auto",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 24px",
                  borderBottom: "1px solid var(--line2)",
                }}
              >
                <RowLink href={`/admin/leads/${lead.id}`} label={`Open ${lead.projectType.name} lead`} />
                <IconTile src={src} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, font: "600 15px/1.25 'Inter'", color: "var(--ink)" }}>
                    {lead.projectType.name}
                  </p>
                  <p style={{ margin: "2px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
                    {lead.projectType.contractorType.name}
                  </p>
                </div>
                <span style={{ font: "400 13px/1 'Inter'", color: "var(--ink2)" }}>
                  {formatDate(lead.createdAt)}
                </span>
                <span style={{ justifySelf: "start" }}>
                  <Chip bg={chip.bg} fg={chip.fg}>
                    {chip.label}
                  </Chip>
                </span>
                <span
                  style={{
                    font: "600 16px/1 'Inter'",
                    color: "var(--ink)",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                  }}
                >
                  {formatMoney(lead.priceCents)}
                </span>
              </div>
            );
          })
        )}
      </Panel>
    </div>
  );
}

function SageStat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: number | null;
}) {
  return (
    <div
      className="a-lift"
      style={{ background: "var(--sage)", borderRadius: 18, padding: "20px 22px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            font: "600 11px/1 'Inter'",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--sageFg)",
            opacity: 0.85,
          }}
        >
          {label}
        </span>
        {typeof trend === "number" && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              font: "600 11px/1 'Inter'",
              color: "var(--sageFg)",
              background: "color-mix(in srgb,var(--sageFg) 14%,transparent)",
              padding: "4px 7px",
              borderRadius: 999,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: trend < 0 ? "scaleY(-1)" : undefined }}>
              <path d="M4 17l7-7 4 4 5-6" />
            </svg>
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p
        style={{
          margin: 0,
          font: "600 30px/1 'Inter'",
          color: "var(--sageFg)",
          letterSpacing: "-.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function PipelineRow({
  color,
  label,
  value,
  border,
  muted,
}: {
  color: string;
  label: string;
  value: number;
  border?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          font: "500 14px/1 'Inter'",
          color: muted ? "var(--ink2)" : "var(--ink)",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: color,
            border: border ? "1px solid var(--line)" : undefined,
          }}
        />
        {label}
      </span>
      <span
        style={{
          font: "600 15px/1 'Inter'",
          color: muted ? "var(--ink2)" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}
