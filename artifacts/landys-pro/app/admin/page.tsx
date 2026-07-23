import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import {
  RevenueHero,
  type RevenuePoint,
  type RevenueRange,
} from "@/components/admin/revenue-hero";
import { PageHeader, GoldButtonLink, Panel, IconTile, Chip } from "@/components/admin/ui";
import { RowLink } from "@/components/admin/row-link";
import { formatMoney } from "@/lib/money";
import { queryNetLeadRevenueCents } from "@/lib/finance";
import { iconSrcFor } from "@/lib/project-icons";
import { leadStatusChip } from "@/lib/admin-display";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning, Admin";
  if (h < 18) return "Good afternoon, Admin";
  return "Good evening, Admin";
}

function parseRange(raw: string | undefined): RevenueRange {
  if (raw === "24h" || raw === "7d" || raw === "30d") return raw;
  return "30d";
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await expireLeads(prisma).catch(() => undefined);

  const { range: rangeParam } = await searchParams;
  const range = parseRange(rangeParam);

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
    declinedMatches,
    expiredMatches,
    chargedLeadCount,
    leadRevenueAllTime,
    charges,
    refunds,
    recentLeads,
  ] = await Promise.all([
    prisma.contractor.count({ where: { deactivatedAt: null } }),
    prisma.contractor.count({ where: { isPro: true, deactivatedAt: null } }),
    prisma.lead.count({ where: { status: { in: ["NEW", "DISTRIBUTED"] } } }),
    prisma.leadMatch.count({ where: { status: "PENDING" } }),
    prisma.leadMatch.count({ where: { status: "ACCEPTED" } }),
    prisma.leadMatch.count({ where: { status: "DECLINED" } }),
    prisma.leadMatch.count({ where: { status: "EXPIRED" } }),
    prisma.walletTransaction.count({ where: { type: "LEAD_CHARGE" } }),
    queryNetLeadRevenueCents(prisma),
    prisma.walletTransaction.findMany({
      where: { type: "LEAD_CHARGE", createdAt: { gte: start365 } },
      select: { amountCents: true, createdAt: true, leadMatchId: true },
    }),
    prisma.walletTransaction.findMany({
      where: { type: "REFUND", createdAt: { gte: start365 } },
      select: { amountCents: true, createdAt: true, leadMatchId: true },
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

  const dailyKey = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  };
  const byDay = new Map<string, number>();
  for (const c of charges) {
    const day = dailyKey(c.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(c.amountCents));
  }
  for (const r of refunds) {
    const day = dailyKey(r.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) - Math.max(0, r.amountCents));
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

  const hourKey = (d: Date) => {
    const x = new Date(d);
    x.setMinutes(0, 0, 0);
    return x.toISOString();
  };
  const byHour = new Map<string, number>();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const c of charges) {
    if (c.createdAt < since24h) continue;
    const key = hourKey(c.createdAt);
    byHour.set(key, (byHour.get(key) ?? 0) + Math.abs(c.amountCents));
  }
  for (const r of refunds) {
    if (r.createdAt < since24h) continue;
    const key = hourKey(r.createdAt);
    byHour.set(key, (byHour.get(key) ?? 0) - Math.max(0, r.amountCents));
  }
  const hourlySeries24h = (): RevenuePoint[] => {
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - 23);
    return Array.from({ length: 24 }, (_, i) => {
      const d = new Date(start);
      d.setHours(start.getHours() + i);
      return {
        label: d.toLocaleTimeString(undefined, { hour: "numeric" }),
        revenueCents: byHour.get(hourKey(d)) ?? 0,
      };
    });
  };

  const series =
    range === "24h" ? hourlySeries24h() : range === "7d" ? dailySeries(7) : dailySeries(30);
  const revenueInRange = series.reduce((s, p) => s + p.revenueCents, 0);

  const mid = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, mid).reduce((s, p) => s + p.revenueCents, 0);
  const secondHalf = series.slice(mid).reduce((s, p) => s + p.revenueCents, 0);
  const trendPct =
    firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : null;

  const pipelineTotal = acceptedMatches + declinedMatches + pendingMatches + expiredMatches;
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
        kicker={`Command center · ${dateStr}`}
        title={greeting()}
        subtitle="Your marketplace at a glance."
        titleSize={38}
        action={<GoldButtonLink href="/admin/leads/new">New lead</GoldButtonLink>}
      />

      {/* HERO STRIP: revenue hero + wallet/stat column */}
      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 16 }}
      >
        <RevenueHero
          value={formatMoney(revenueInRange)}
          trend={trendPct}
          series={series}
          range={range}
        />

        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 16 }}>
          <div
            className="a-lift"
            style={{
              background: "var(--sage)",
              borderRadius: 20,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                font: "600 11px/1 var(--mono)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--sageFg)",
                opacity: 0.85,
              }}
            >
              Lead revenue · all time
            </p>
            <p
              style={{
                margin: 0,
                font: "600 30px/1 var(--display)",
                color: "var(--sageFg)",
                letterSpacing: "-.02em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatMoney(leadRevenueAllTime)}
            </p>
            <p style={{ margin: "6px 0 0", font: "500 12px/1 'Inter'", color: "var(--sageFg)", opacity: 0.8 }}>
              Charged on {chargedLeadCount} accepted lead{chargedLeadCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="admin-grid-tight" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <MiniStat label="Open leads" value={String(openLeads)} sub={`${pendingMatches} awaiting a match`} />
            <MiniStat label="Contractors" value={String(contractors)} sub={`${proContractors} on Pro plan`} />
          </div>
        </div>
      </div>

      {/* PIPELINE + RECENT LEADS */}
      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}
      >
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: "22px 24px",
            boxShadow: "var(--shadowSm)",
          }}
        >
          <p
            style={{
              margin: "0 0 3px",
              font: "600 13px/1 'Inter'",
              letterSpacing: ".02em",
              textTransform: "uppercase",
              color: "var(--ink2)",
            }}
          >
            Match pipeline
          </p>
          <p style={{ margin: "0 0 18px", color: "var(--ink3)", fontSize: 13 }}>
            {pipelineTotal} match{pipelineTotal === 1 ? "" : "es"} all time
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
            <div style={{ width: `${pct(declinedMatches)}%`, background: "var(--chipFg)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <PipelineRow color="var(--gold)" label="Accepted" value={acceptedMatches} />
            <PipelineRow color="var(--chipFg)" label="Passed" value={declinedMatches} />
            <PipelineRow color="#D8B577" label="Pending" value={pendingMatches} />
            <PipelineRow color="var(--track)" border label="Expired" value={expiredMatches} muted />
          </div>
          <div
            style={{
              marginTop: 20,
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
                font: "600 20px/1 var(--display)",
                color: "var(--sageFg)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {acceptanceRate}%
            </span>
          </div>
        </div>

        <Panel style={{ borderRadius: 20, boxShadow: "var(--shadowSm)", overflow: "hidden" }}>
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
            <Link
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
            </Link>
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
                    gridTemplateColumns: "44px 1fr auto auto",
                    alignItems: "center",
                    gap: 14,
                    padding: "13px 24px",
                    borderBottom: "1px solid var(--line2)",
                  }}
                >
                  <RowLink href={`/admin/leads/${lead.id}`} label={`Open ${lead.projectType.name} lead`} />
                  <IconTile src={src} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: "600 14px/1.25 'Inter'", color: "var(--ink)" }}>
                      {lead.projectType.name}
                    </p>
                    <p style={{ margin: "2px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
                      {lead.projectType.contractorType.name}
                    </p>
                  </div>
                  <span style={{ justifySelf: "start" }}>
                    <Chip bg={chip.bg} fg={chip.fg}>
                      {chip.label}
                    </Chip>
                  </span>
                  <span
                    style={{
                      font: "600 16px/1 var(--display)",
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
    </div>
  );
}

/** Small white KPI card used in the dashboard hero column. */
function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      className="a-lift"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 20,
        padding: "18px 20px",
        boxShadow: "var(--shadowSm)",
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          font: "600 11px/1 var(--mono)",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "0 0 6px", font: "600 28px/1 var(--display)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      <p style={{ margin: 0, font: "500 12px/1.2 'Inter'", color: "var(--ink2)" }}>{sub}</p>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
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
