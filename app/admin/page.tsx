import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import type { RevenuePoint } from "@/components/admin/revenue-chart";
import { PageHeader, GoldButtonLink, Panel, IconTile, Chip } from "@/components/admin/ui";
import { RowLink } from "@/components/admin/row-link";
import { formatMoney } from "@/lib/money";
import { iconSrcFor } from "@/lib/project-icons";
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
    heldAcross,
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
    prisma.contractor.count({ where: { walletBalanceCents: { gt: 0 } } }),
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
  for (const c of charges) {
    const day = dailyKey(c.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(c.amountCents));
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

  const d30 = dailySeries(30);

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
        <RevenueHero value={formatMoney(revenue30)} trend={trendPct} series={d30} />

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
              Wallet float
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
              {formatMoney(walletFloat)}
            </p>
            <p style={{ margin: "6px 0 0", font: "500 12px/1 'Inter'", color: "var(--sageFg)", opacity: 0.8 }}>
              Liability held across {heldAcross} contractor{heldAcross === 1 ? "" : "s"}
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
            {pipelineTotal} match{pipelineTotal === 1 ? "" : "es"} this period
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
          <div style={{ display: "flex", flexDirection: "column" }}>
            <PipelineRow color="var(--gold)" label="Accepted" value={acceptedMatches} />
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

/** Dark-green revenue hero with a data-driven area sparkline (matches the model). */
function RevenueHero({
  value,
  trend,
  series,
}: {
  value: string;
  trend: number | null;
  series: RevenuePoint[];
}) {
  const W = 620;
  const H = 92;
  const values = series.map((p) => p.revenueCents);
  const max = Math.max(1, ...values);
  const n = values.length;
  const pointsArr = values.map((v, i) => {
    const x = n <= 1 ? W : (i / (n - 1)) * W;
    const y = H - (v / max) * (H - 8) - 4;
    return [Math.round(x), Math.round(y)] as const;
  });
  const line = pointsArr.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const last = pointsArr[pointsArr.length - 1] ?? [W, H];

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        padding: "26px 28px",
        background: "linear-gradient(150deg,var(--green),var(--green2))",
        color: "#F1E7D6",
        boxShadow: "var(--shadowMd)",
      }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: trend < 0 ? "scaleY(-1)" : undefined }}>
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
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        width="100%"
        height="92"
        preserveAspectRatio="none"
        aria-hidden
        style={{ position: "relative", marginTop: 14, overflow: "visible" }}
      >
        <defs>
          <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#heroFill)" points={area} />
        <polyline fill="none" stroke="var(--gold)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" points={line} />
        <circle cx={last[0]} cy={last[1]} r="5" fill="var(--gold)" stroke="var(--green)" strokeWidth="2.5" />
      </svg>
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
