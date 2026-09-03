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
import { formatDate } from "@/lib/format";
import { iconSrcFor } from "@/lib/project-icons";
import { leadCategoryIcon, leadCategoryLabel, leadScopeLabel } from "@/lib/resolved-lead";
import { leadStatusChip } from "@/lib/admin-display";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function parseRange(raw: string | undefined): RevenueRange {
  if (raw === "7d" || raw === "90d" || raw === "all") return raw;
  return "30d";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dailyKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

/** Build a zero-filled PAID-fee series for the selected window. */
function buildPaidSeries(
  paidFees: { feeAmountCents: number; paidAt: Date | null }[],
  range: RevenueRange,
  now: Date,
): RevenuePoint[] {
  const withPaidAt = paidFees.filter((f): f is { feeAmountCents: number; paidAt: Date } => Boolean(f.paidAt));

  if (range !== "all") {
    const rangeDays = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const rangeStart = startOfDay(now);
    rangeStart.setDate(rangeStart.getDate() - (rangeDays - 1));

    const byDay = new Map<string, number>();
    for (const fee of withPaidAt) {
      const day = dailyKey(fee.paidAt);
      byDay.set(day, (byDay.get(day) ?? 0) + fee.feeAmountCents);
    }

    return Array.from({ length: rangeDays }, (_, i) => {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      return {
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenueCents: byDay.get(dailyKey(d)) ?? 0,
      };
    });
  }

  // All-time: daily when history is short, monthly when it stretches.
  if (withPaidAt.length === 0) {
    return [{ label: "—", revenueCents: 0 }];
  }

  const earliest = withPaidAt.reduce(
    (min, f) => (f.paidAt < min ? f.paidAt : min),
    withPaidAt[0].paidAt,
  );
  const start = startOfDay(earliest);
  const end = startOfDay(now);
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

  if (spanDays <= 120) {
    const byDay = new Map<string, number>();
    for (const fee of withPaidAt) {
      const day = dailyKey(fee.paidAt);
      byDay.set(day, (byDay.get(day) ?? 0) + fee.feeAmountCents);
    }
    return Array.from({ length: spanDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenueCents: byDay.get(dailyKey(d)) ?? 0,
      };
    });
  }

  const byMonth = new Map<string, number>();
  for (const fee of withPaidAt) {
    const key = monthKey(fee.paidAt);
    byMonth.set(key, (byMonth.get(key) ?? 0) + fee.feeAmountCents);
  }

  const series: RevenuePoint[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    const key = monthKey(cursor);
    series.push({
      label: cursor.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      revenueCents: byMonth.get(key) ?? 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return series.length > 0 ? series : [{ label: "—", revenueCents: 0 }];
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

  const paidWhere =
    range === "all"
      ? { status: "PAID" as const }
      : {
          status: "PAID" as const,
          paidAt: {
            gte: (() => {
              const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
              const start = startOfDay(now);
              start.setDate(start.getDate() - (days - 1));
              return start;
            })(),
          },
        };

  const [
    openRequests,
    wonJobs,
    feesDue,
    feesCollectedCents,
    paidInRange,
    opportunitiesAttention,
    feesAttention,
    pendingConfirmations,
    recentWon,
  ] = await Promise.all([
    prisma.lead.count({ where: { status: { in: ["NEW", "DISTRIBUTED"] } } }),
    prisma.leadMatch.count({ where: { jobOutcome: "WON" } }),
    prisma.successFee.count({ where: { status: "DUE" } }),
    prisma.successFee
      .aggregate({ where: { status: "PAID" }, _sum: { feeAmountCents: true } })
      .then((r) => r._sum.feeAmountCents ?? 0),
    prisma.successFee.findMany({
      where: paidWhere,
      select: { feeAmountCents: true, paidAt: true },
    }),
    // Open pipeline that still needs ops eyes (oldest first).
    prisma.lead.findMany({
      where: { status: { in: ["NEW", "DISTRIBUTED"] } },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: {
        id: true,
        status: true,
        budgetCents: true,
        acceptedCount: true,
        createdAt: true,
        propertyLocation: true,
        projectType: {
          select: { name: true, contractorType: { select: { name: true, icon: true } } },
        },
        workType: { select: { name: true } },
        contractorCategory: { select: { name: true } },
        _count: { select: { matches: true } },
      },
    }),
    prisma.successFee.findMany({
      where: { status: { in: ["DUE", "AWAITING_CONTRACTOR_PAYMENT"] } },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        leadMatch: {
          include: {
            contractor: { select: { name: true } },
            lead: {
              select: {
                propertyLocation: true,
                projectType: { select: { name: true } },
                workType: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.landownerConfirmation.findMany({
      where: { OR: [{ respondedAt: null }, { mismatchFlagged: true }] },
      orderBy: [{ mismatchFlagged: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        lead: {
          select: {
            id: true,
            landownerName: true,
            propertyLocation: true,
            projectType: { select: { name: true } },
            workType: { select: { name: true } },
          },
        },
        hiredLeadMatch: { select: { contractor: { select: { name: true } } } },
      },
    }),
    prisma.leadMatch.findMany({
      where: { jobOutcome: "WON" },
      orderBy: { outcomeReportedAt: "desc" },
      take: 5,
      include: {
        contractor: { select: { name: true } },
        successFee: { select: { status: true, feeAmountCents: true } },
        lead: {
          select: {
            propertyLocation: true,
            projectType: { select: { name: true } },
            workType: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const series = buildPaidSeries(paidInRange, range, now);
  const revenueInRange = series.reduce((s, p) => s + p.revenueCents, 0);
  const mid = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, mid).reduce((s, p) => s + p.revenueCents, 0);
  const secondHalf = series.slice(mid).reduce((s, p) => s + p.revenueCents, 0);
  const trendPct =
    firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : null;

  const dateStr = now.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const metrics = [
    {
      label: "Open requests",
      value: openRequests,
      href: "/admin/leads",
      hint: "New & distributed",
    },
    {
      label: "Won jobs",
      value: wonJobs,
      href: "/admin/fees",
      hint: "Reported won",
    },
    {
      label: "Fees due",
      value: feesDue,
      href: "/admin/fees?tab=due",
      hint: "Owed to Landy's",
    },
    {
      label: "Fees collected",
      value: formatMoney(feesCollectedCents),
      href: "/admin/fees?tab=paid",
      hint: "All-time paid",
    },
  ];

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker={`Operations · ${dateStr}`}
        title={greeting()}
        subtitle="What needs attention — open requests, fees, confirmations, and won jobs."
        titleSize={36}
        action={<GoldButtonLink href="/admin/leads/new">New request</GoldButtonLink>}
      />

      <div
        className="admin-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="a-lift"
            style={{
              textDecoration: "none",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "var(--shadowSm)",
              display: "block",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                font: "600 10px/1 var(--mono)",
                letterSpacing: ".07em",
                textTransform: "uppercase",
                color: "var(--ink3)",
              }}
            >
              {m.label}
            </p>
            <p
              style={{
                margin: "0 0 4px",
                font: "600 24px/1 var(--display)",
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {m.value}
            </p>
            <p style={{ margin: 0, font: "500 12px/1.2 'Inter'", color: "var(--ink2)" }}>{m.hint}</p>
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <RevenueHero
          value={formatMoney(revenueInRange)}
          trend={trendPct}
          series={series}
          range={range}
        />
      </div>

      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}
      >
        <Panel style={{ borderRadius: 18, boxShadow: "var(--shadowSm)", overflow: "hidden" }}>
          <SectionHead title="Opportunities needing attention" href="/admin/leads" />
          {opportunitiesAttention.length === 0 ? (
            <EmptyBlock text="No open estimate requests need attention." />
          ) : (
            opportunitiesAttention.map((lead) => {
              const chip = leadStatusChip(lead.status);
              const src = iconSrcFor({
                icon: leadCategoryIcon(lead),
                category: leadCategoryLabel(lead),
                project: leadScopeLabel(lead),
              });
              const est = lead.budgetCents;
              return (
                <div
                  key={lead.id}
                  className="a-row"
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "44px minmax(0,1fr) auto",
                    alignItems: "center",
                    gap: 14,
                    padding: "13px 22px",
                    borderBottom: "1px solid var(--line2)",
                  }}
                >
                  <RowLink href={`/admin/leads/${lead.id}`} label={`Open ${leadScopeLabel(lead)}`} />
                  <IconTile src={src} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: "600 14px/1.25 'Inter'", color: "var(--ink)" }}>
                      {leadScopeLabel(lead)}
                    </p>
                    <p style={{ margin: "2px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                      {lead.propertyLocation} · {lead._count.matches} matched · {lead.acceptedCount}{" "}
                      accepted · {formatDate(lead.createdAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Chip bg={chip.bg} fg={chip.fg}>
                      {chip.label}
                    </Chip>
                    <p
                      style={{
                        margin: "6px 0 0",
                        font: "600 14px/1 var(--display)",
                        color: "var(--ink)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {est != null ? formatMoney(est) : "—"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </Panel>

        <Panel style={{ borderRadius: 18, boxShadow: "var(--shadowSm)", overflow: "hidden" }}>
          <SectionHead title="Fees requiring action" href="/admin/fees" />
          {feesAttention.length === 0 ? (
            <EmptyBlock text="No fees need attention right now." />
          ) : (
            feesAttention.map((fee) => {
              const awaiting = fee.status === "AWAITING_CONTRACTOR_PAYMENT";
              return (
                <div
                  key={fee.id}
                  style={{
                    padding: "14px 22px",
                    borderBottom: "1px solid var(--line2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, font: "600 14px/1.25 'Inter'", color: "var(--ink)" }}>
                        {leadScopeLabel(fee.leadMatch.lead)}
                      </p>
                      <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                        {fee.leadMatch.contractor.name} · {fee.leadMatch.lead.propertyLocation}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <p
                        style={{
                          margin: 0,
                          font: "600 15px/1 var(--display)",
                          color: "var(--ink)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMoney(fee.feeAmountCents)}
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          font: "600 11px/1 'Inter'",
                          color: awaiting ? "var(--goldSoftFg)" : "var(--danger)",
                        }}
                      >
                        {awaiting ? "Awaiting contractor" : "Due"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Panel>
      </div>

      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <Panel style={{ borderRadius: 18, boxShadow: "var(--shadowSm)", overflow: "hidden" }}>
          <SectionHead title="Pending confirmations & mismatches" href="/admin/confirmations" />
          {pendingConfirmations.length === 0 ? (
            <EmptyBlock text="No pending confirmations or mismatches." />
          ) : (
            pendingConfirmations.map((row) => (
              <div
                key={row.id}
                style={{ padding: "14px 22px", borderBottom: "1px solid var(--line2)" }}
              >
                <p style={{ margin: 0, font: "600 14px/1.25 'Inter'", color: "var(--ink)" }}>
                  {leadScopeLabel(row.lead)}
                </p>
                <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                  {row.lead.landownerName ?? "Landowner"} · {row.lead.propertyLocation}
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    font: "600 12px/1 'Inter'",
                    color: row.mismatchFlagged ? "var(--danger)" : "var(--ink2)",
                  }}
                >
                  {row.mismatchFlagged
                    ? "Mismatch — needs review"
                    : "Waiting for landowner response."}
                </p>
              </div>
            ))
          )}
        </Panel>

        <Panel style={{ borderRadius: 18, boxShadow: "var(--shadowSm)", overflow: "hidden" }}>
          <SectionHead title="Recent won jobs" href="/admin/fees" />
          {recentWon.length === 0 ? (
            <EmptyBlock text="No won jobs yet." />
          ) : (
            recentWon.map((m) => (
              <div
                key={m.id}
                style={{ padding: "14px 22px", borderBottom: "1px solid var(--line2)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: "600 14px/1.25 'Inter'", color: "var(--ink)" }}>
                      {leadScopeLabel(m.lead)}
                    </p>
                    <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                      {m.contractor.name}
                      {m.outcomeReportedAt ? ` · ${formatDate(m.outcomeReportedAt)}` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    {m.successFee ? (
                      <>
                        <p
                          style={{
                            margin: 0,
                            font: "600 14px/1 var(--display)",
                            color: "var(--ink)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatMoney(m.successFee.feeAmountCents)}
                        </p>
                        <p style={{ margin: "4px 0 0", font: "500 11px/1 'Inter'", color: "var(--ink3)" }}>
                          {m.successFee.status === "PAID"
                            ? "Paid"
                            : m.successFee.status === "DUE"
                              ? "Due"
                              : "Awaiting"}
                        </p>
                      </>
                    ) : (
                      <p style={{ margin: 0, font: "500 12px/1 'Inter'", color: "var(--ink3)" }}>—</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 22px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <p style={{ margin: 0, font: "600 15px/1 'Inter'", color: "var(--ink)" }}>{title}</p>
      <Link
        href={href}
        className="a-linkgold"
        style={{ font: "600 13px/1 'Inter'", color: "var(--gold)", textDecoration: "none" }}
      >
        View all
      </Link>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <p style={{ padding: "28px 22px", margin: 0, color: "var(--ink3)", fontSize: 14, lineHeight: 1.5 }}>
      {text}
    </p>
  );
}
