import Link from "next/link";
import { SystemHealth } from "@/components/admin/system-health";
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
    return [{ label: "", revenueCents: 0 }];
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
  return series.length > 0 ? series : [{ label: "", revenueCents: 0 }];
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
        successFee: { select: { status: true, feeAmountCents: true, leadMatchId: true } },
        lead: {
          select: {
            id: true,
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

  // Landy's runs in Texas: the heading uses Central time, not the server's.
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });

  const metrics = [
    { label: "Open requests", value: String(openRequests), href: "/admin/leads", hint: "New or sent, not closed yet" },
    { label: "Won jobs", value: String(wonJobs), href: "/admin/fees", hint: "Reported by contractors" },
    { label: "Fees due", value: String(feesDue), href: "/admin/fees?tab=due", hint: "Owed to Landy's" },
    {
      label: "Fees collected",
      value: formatMoney(feesCollectedCents),
      href: "/admin/fees?tab=paid",
      hint: "All time",
    },
  ];

  return (
    <div>
      <PageHeader
        title={today}
        subtitle={`${greeting()}. Here is what is waiting and how the business is doing.`}
        titleSize={34}
        action={<GoldButtonLink href="/admin/leads/new">New request</GoldButtonLink>}
      />
      <SystemHealth />

      <div
        className="admin-stat-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 16 }}
      >
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} style={{ textDecoration: "none", display: "block", padding: "16px 20px" }}>
            <p style={{ margin: 0, font: "500 14px/1.3 var(--ui)", color: "var(--ink2)" }}>{m.label}</p>
            <p style={{ margin: "8px 0 0", font: "700 30px/1 var(--head)", color: "var(--ink)" }}>{m.value}</p>
            <p style={{ margin: "6px 0 0", font: "400 13px/1.3 var(--ui)", color: "var(--ink3)" }}>{m.hint}</p>
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <RevenueHero value={formatMoney(revenueInRange)} paidCount={paidInRange.length} series={series} range={range} />
      </div>

      <div className="admin-grid-stack" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel style={{ overflow: "hidden" }}>
          <SectionHead title="Open requests" note="Oldest first" href="/admin/leads" />
          {opportunitiesAttention.length === 0 ? (
            <EmptyBlock text="No open request. New ones from landys.co show up here." />
          ) : (
            opportunitiesAttention.map((lead) => {
              const chip = leadStatusChip(lead.status);
              const src = iconSrcFor({
                icon: leadCategoryIcon(lead),
                category: leadCategoryLabel(lead),
                project: leadScopeLabel(lead),
              });
              return (
                <div
                  key={lead.id}
                  className="a-row"
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "40px minmax(0,1fr) auto",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--line2)",
                  }}
                >
                  <RowLink href={`/admin/leads/${lead.id}`} label={`Open ${leadScopeLabel(lead)}`} />
                  <IconTile src={src} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: "600 15px/1.3 var(--ui)", color: "var(--ink)" }}>
                      {leadScopeLabel(lead)}
                    </p>
                    <Meta
                      items={[
                        lead.propertyLocation,
                        `${lead.acceptedCount} of ${lead._count.matches} accepted`,
                        formatDate(lead.createdAt),
                      ]}
                    />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Chip bg={chip.bg} fg={chip.fg}>
                      {chip.label}
                    </Chip>
                    <p style={{ margin: "6px 0 0", font: "600 15px/1 var(--head)", color: "var(--ink)" }}>
                      {lead.budgetCents != null ? formatMoney(lead.budgetCents) : "No budget"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </Panel>

        <Panel style={{ overflow: "hidden" }}>
          <SectionHead title="Fees to follow up" href="/admin/fees" />
          {feesAttention.length === 0 ? (
            <EmptyBlock text="No fee is due. Fees appear here once a contractor reports a won job." />
          ) : (
            feesAttention.map((fee) => {
              const awaiting = fee.status === "AWAITING_CONTRACTOR_PAYMENT";
              return (
                <div
                  key={fee.id}
                  className="a-row"
                  style={{ position: "relative", padding: "12px 20px", borderBottom: "1px solid var(--line2)" }}
                >
                  <RowLink
                    href={`/admin/fees/${fee.leadMatchId}`}
                    label={`Open fee for ${leadScopeLabel(fee.leadMatch.lead)}`}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, font: "600 15px/1.3 var(--ui)", color: "var(--ink)" }}>
                        {fee.leadMatch.contractor.name}
                      </p>
                      <Meta items={[leadScopeLabel(fee.leadMatch.lead), fee.leadMatch.lead.propertyLocation]} />
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <p style={{ margin: 0, font: "600 16px/1 var(--head)", color: "var(--ink)" }}>
                        {formatMoney(fee.feeAmountCents)}
                      </p>
                      <p
                        style={{
                          margin: "5px 0 0",
                          font: "500 13px/1 var(--ui)",
                          color: awaiting ? "var(--ink2)" : "var(--danger)",
                        }}
                      >
                        {awaiting ? "Waiting on the homeowner" : "Due"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Panel>
      </div>

      <div className="admin-grid-stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel style={{ overflow: "hidden" }}>
          <SectionHead title="Homeowner confirmations" href="/admin/confirmations" />
          {pendingConfirmations.length === 0 ? (
            <EmptyBlock text="No confirmation pending and no mismatch to review." />
          ) : (
            pendingConfirmations.map((row) => (
              <div
                key={row.id}
                className="a-row"
                style={{ position: "relative", padding: "12px 20px", borderBottom: "1px solid var(--line2)" }}
              >
                <RowLink
                  href={`/admin/leads/${row.lead.id}`}
                  label={`Open confirmation for ${leadScopeLabel(row.lead)}`}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: "600 15px/1.3 var(--ui)", color: "var(--ink)" }}>
                      {row.lead.landownerName ?? "Homeowner"}
                    </p>
                    <Meta items={[leadScopeLabel(row.lead), row.lead.propertyLocation]} />
                  </div>
                  <p
                    style={{
                      margin: 0,
                      flex: "none",
                      font: "500 13px/1.2 var(--ui)",
                      color: row.mismatchFlagged ? "var(--danger)" : "var(--ink2)",
                    }}
                  >
                    {row.mismatchFlagged ? "Answers do not match" : "No answer yet"}
                  </p>
                </div>
              </div>
            ))
          )}
        </Panel>

        <Panel style={{ overflow: "hidden" }}>
          <SectionHead title="Recent won jobs" href="/admin/fees" />
          {recentWon.length === 0 ? (
            <EmptyBlock text="No won job yet. They appear when a contractor reports one." />
          ) : (
            recentWon.map((m) => (
              <div
                key={m.id}
                className="a-row"
                style={{ position: "relative", padding: "12px 20px", borderBottom: "1px solid var(--line2)" }}
              >
                <RowLink
                  href={m.successFee ? `/admin/fees/${m.successFee.leadMatchId}` : `/admin/leads/${m.lead.id}`}
                  label={`Open ${leadScopeLabel(m.lead)}`}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: "600 15px/1.3 var(--ui)", color: "var(--ink)" }}>
                      {m.contractor.name}
                    </p>
                    <Meta
                      items={[
                        leadScopeLabel(m.lead),
                        m.outcomeReportedAt ? formatDate(m.outcomeReportedAt) : null,
                      ]}
                    />
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    {m.successFee ? (
                      <>
                        <p style={{ margin: 0, font: "600 16px/1 var(--head)", color: "var(--ink)" }}>
                          {formatMoney(m.successFee.feeAmountCents)}
                        </p>
                        <p style={{ margin: "5px 0 0", font: "500 13px/1 var(--ui)", color: "var(--ink2)" }}>
                          {m.successFee.status === "PAID"
                            ? "Fee paid"
                            : m.successFee.status === "DUE"
                              ? "Fee due"
                              : "Waiting on the homeowner"}
                        </p>
                      </>
                    ) : (
                      <p style={{ margin: 0, font: "500 13px/1 var(--ui)", color: "var(--ink3)" }}>No fee yet</p>
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

function SectionHead({ title, note, href }: { title: string; note?: string; href: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <h2 style={{ margin: 0, font: "600 17px/1.2 var(--head)", color: "var(--ink)" }}>
        {title}
        {note && <span style={{ marginLeft: 8, font: "400 13px/1 var(--ui)", color: "var(--ink3)" }}>{note}</span>}
      </h2>
      <Link href={href} className="a-linkgold" style={{ font: "600 14px/1 var(--ui)", color: "var(--gold)" }}>
        View all
      </Link>
    </div>
  );
}

/** Secondary line under a row title: separate facts, spaced, no dot separators. */
function Meta({ items }: { items: (string | null | undefined)[] }) {
  return (
    <p
      style={{
        margin: "3px 0 0",
        display: "flex",
        flexWrap: "wrap",
        columnGap: 14,
        rowGap: 2,
        font: "400 13px/1.35 var(--ui)",
        color: "var(--ink3)",
      }}
    >
      {items.filter(Boolean).map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </p>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <p style={{ padding: "24px 20px", margin: 0, color: "var(--ink2)", fontSize: 14, lineHeight: 1.5 }}>{text}</p>;
}
