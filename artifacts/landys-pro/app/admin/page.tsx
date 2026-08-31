import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
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

export default async function AdminDashboard() {
  await expireLeads(prisma).catch(() => undefined);

  const now = new Date();
  const [
    openRequests,
    acceptedOpportunities,
    wonJobs,
    feesAwaiting,
    feesDue,
    feesCollectedCents,
    feesCollectedCount,
    confirmationsReview,
    recentLeads,
    feesAttention,
    pendingConfirmations,
    recentWon,
  ] = await Promise.all([
    prisma.lead.count({ where: { status: { in: ["NEW", "DISTRIBUTED"] } } }),
    prisma.leadMatch.count({ where: { status: "ACCEPTED" } }),
    prisma.leadMatch.count({ where: { jobOutcome: "WON" } }),
    prisma.successFee.count({ where: { status: "AWAITING_CONTRACTOR_PAYMENT" } }),
    prisma.successFee.count({ where: { status: "DUE" } }),
    prisma.successFee
      .aggregate({ where: { status: "PAID" }, _sum: { feeAmountCents: true } })
      .then((r) => r._sum.feeAmountCents ?? 0),
    prisma.successFee.count({ where: { status: "PAID" } }),
    prisma.landownerConfirmation.count({ where: { mismatchFlagged: true } }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
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

  const dateStr = now.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const metrics = [
    { label: "Open requests", value: openRequests, href: "/admin/leads", hint: "New & distributed" },
    { label: "Accepted", value: acceptedOpportunities, href: "/admin/leads", hint: "Opportunities" },
    { label: "Won jobs", value: wonJobs, href: "/admin/fees", hint: "Reported won" },
    {
      label: "Awaiting payment",
      value: feesAwaiting,
      href: "/admin/fees?tab=awaiting",
      hint: "Contractor not yet paid",
    },
    { label: "Fees due", value: feesDue, href: "/admin/fees?tab=due", hint: "Owed to Landy's" },
    {
      label: "Fees collected",
      value: formatMoney(feesCollectedCents),
      href: "/admin/fees?tab=paid",
      hint: `${feesCollectedCount} paid`,
      isMoney: true,
    },
    {
      label: "Needs review",
      value: confirmationsReview,
      href: "/admin/confirmations?tab=mismatches",
      hint: "Confirmation mismatches",
    },
  ];

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker={`Operations · ${dateStr}`}
        title={greeting()}
        subtitle="Success-fee pipeline — opportunities, won jobs, and fees that need attention."
        titleSize={36}
        action={<GoldButtonLink href="/admin/leads/new">New request</GoldButtonLink>}
      />

      <div
        className="admin-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 22,
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
              padding: "16px 18px",
              boxShadow: "var(--shadowSm)",
              display: "block",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
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
                font: "600 26px/1 var(--display)",
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

      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}
      >
        <Panel style={{ borderRadius: 18, boxShadow: "var(--shadowSm)", overflow: "hidden" }}>
          <SectionHead title="Recent opportunities" href="/admin/leads" />
          {recentLeads.length === 0 ? (
            <EmptyBlock text="No estimate requests yet. New Landys.co requests will appear here." />
          ) : (
            recentLeads.map((lead) => {
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
                      accepted
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
          <SectionHead title="Fees requiring attention" href="/admin/fees" />
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
          <SectionHead title="Confirmations & mismatches" href="/admin/confirmations" />
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
