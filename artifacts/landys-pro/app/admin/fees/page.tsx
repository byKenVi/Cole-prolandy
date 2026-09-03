import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Chip,
  Panel,
  AdminTabBar,
  AdminTabLink,
  AdminEmptyState,
} from "@/components/admin/ui";
import { MarkFeePaidButton } from "@/components/admin/mark-fee-paid-button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { leadScopeLabel } from "@/lib/resolved-lead";
import type { SuccessFeeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type FeeTab = "all" | "awaiting" | "due" | "paid";

const thStyle: React.CSSProperties = {
  padding: "12px 20px",
  textAlign: "left",
  font: "600 10px/1 var(--mono)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 20px",
  font: "400 14px/1.35 'Inter'",
  verticalAlign: "top",
};

function parseTab(raw: string | undefined): FeeTab {
  if (raw === "awaiting" || raw === "due" || raw === "paid" || raw === "all") return raw;
  return "all";
}

function statusFilter(tab: FeeTab): { status: SuccessFeeStatus | { in: SuccessFeeStatus[] } } {
  if (tab === "awaiting") return { status: "AWAITING_CONTRACTOR_PAYMENT" };
  if (tab === "due") return { status: "DUE" };
  if (tab === "paid") return { status: "PAID" };
  return { status: { in: ["AWAITING_CONTRACTOR_PAYMENT", "DUE", "PAID"] } };
}

function feeStatusMeta(status: string): {
  label: string;
  short: string;
  hint: string;
  bg: string;
  fg: string;
} {
  switch (status) {
    case "AWAITING_CONTRACTOR_PAYMENT":
      return {
        label: "Awaiting contractor payment",
        short: "Awaiting",
        hint: "Won — waiting for the contractor to confirm the landowner paid them.",
        bg: "var(--goldSoft)",
        fg: "var(--goldSoftFg)",
      };
    case "DUE":
      return {
        label: "Due",
        short: "Due",
        hint: "Contractor confirmed paid. Landy's fee is owed.",
        bg: "var(--dangerBg)",
        fg: "var(--danger)",
      };
    case "PAID":
      return {
        label: "Paid",
        short: "Paid",
        hint: "Settled with Landy's.",
        bg: "var(--posBg)",
        fg: "var(--pos)",
      };
    default:
      return {
        label: status,
        short: status,
        hint: "",
        bg: "var(--chipBg)",
        fg: "var(--ink3)",
      };
  }
}

function formatRate(bps: number): string {
  const pct = bps / 100;
  return pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

function paymentMethodMeta(method: string | null | undefined): {
  label: string;
  bg: string;
  fg: string;
} {
  if (method === "stripe") {
    return { label: "Stripe", bg: "var(--posBg)", fg: "var(--pos)" };
  }
  if (method === "manual" || !method) {
    return { label: "Manual / Check", bg: "var(--chipBg)", fg: "var(--ink2)" };
  }
  return { label: method, bg: "var(--chipBg)", fg: "var(--ink2)" };
}

function relevantDate(fee: {
  status: string;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}): { label: string; value: Date } {
  if (fee.status === "PAID" && fee.paidAt) return { label: "Paid", value: fee.paidAt };
  if (fee.status === "DUE" && fee.dueAt) return { label: "Due since", value: fee.dueAt };
  if (fee.status === "AWAITING_CONTRACTOR_PAYMENT") {
    return { label: "Opened", value: fee.createdAt };
  }
  if (fee.dueAt) return { label: "Due", value: fee.dueAt };
  return { label: "Created", value: fee.createdAt };
}

function emptyCopy(tab: FeeTab): { title: string; description: string } {
  switch (tab) {
    case "awaiting":
      return {
        title: "Nothing awaiting contractor payment",
        description:
          "Fees land here after a contractor reports a won job — until they confirm the landowner paid them.",
      };
    case "due":
      return {
        title: "No fees due",
        description:
          "When a contractor confirms they were paid, the Landy's success fee shows up here for collection.",
      };
    case "paid":
      return {
        title: "No paid fees yet",
        description: "Stripe checkouts and manual / check settlements appear in this list.",
      };
    default:
      return {
        title: "No success fees yet",
        description:
          "Fees appear after contractors report won jobs — then move from awaiting → due → paid.",
      };
  }
}

function tabHint(tab: FeeTab): string {
  switch (tab) {
    case "awaiting":
      return "Contractor won the job. Waiting for them to confirm the landowner paid.";
    case "due":
      return "Landy's fee is owed. Mark paid when you receive a check or manual payment.";
    case "paid":
      return "Settled fees — Stripe online, or Manual / Check when recorded by admin.";
    default:
      return "Track every success fee from won job through settlement.";
  }
}

function FeeEmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

export default async function AdminFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab = parseTab(tabRaw);

  const [awaitingCount, dueCount, paidCount, fees] = await Promise.all([
    prisma.successFee.count({ where: { status: "AWAITING_CONTRACTOR_PAYMENT" } }),
    prisma.successFee.count({ where: { status: "DUE" } }),
    prisma.successFee.count({ where: { status: "PAID" } }),
    prisma.successFee.findMany({
      where: statusFilter(tab),
      orderBy: [{ status: "asc" }, { dueAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        leadMatch: {
          include: {
            contractor: { select: { name: true, email: true } },
            lead: {
              select: {
                landownerName: true,
                propertyLocation: true,
                projectType: { select: { name: true } },
                workType: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const allCount = awaitingCount + dueCount + paidCount;
  const empty = emptyCopy(tab);

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Revenue"
        title="Success fees"
        subtitle="Landy's cut on won jobs — from contractor payment confirmation through settlement."
      />

      <AdminTabBar aria-label="Fee status">
        <AdminTabLink href="/admin/fees?tab=all" active={tab === "all"} count={allCount}>
          All
        </AdminTabLink>
        <AdminTabLink
          href="/admin/fees?tab=awaiting"
          active={tab === "awaiting"}
          count={awaitingCount}
          tone="gold"
        >
          Awaiting Contractor Payment
        </AdminTabLink>
        <AdminTabLink
          href="/admin/fees?tab=due"
          active={tab === "due"}
          count={dueCount}
          tone="danger"
        >
          Due
        </AdminTabLink>
        <AdminTabLink
          href="/admin/fees?tab=paid"
          active={tab === "paid"}
          count={paidCount}
          tone="pos"
        >
          Paid
        </AdminTabLink>
      </AdminTabBar>

      <p
        style={{
          margin: "-6px 0 16px",
          font: "400 13px/1.45 'Inter'",
          color: "var(--ink3)",
          maxWidth: 640,
        }}
      >
        {tabHint(tab)}
      </p>

      <div
        style={{
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid var(--line)",
          background: "var(--card)",
          boxShadow: "var(--shadow)",
        }}
      >
        {fees.length === 0 ? (
          <AdminEmptyState title={empty.title} description={empty.description} icon={<FeeEmptyIcon />} />
        ) : (
          <>
            <table className="admin-table-desktop" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Contractor</th>
                  <th style={thStyle}>Final contract value</th>
                  <th style={thStyle}>Success-fee %</th>
                  <th style={thStyle}>Landy&apos;s fee</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>
                    {tab === "due" ? "Collect" : tab === "paid" ? "Method" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => {
                  const meta = feeStatusMeta(fee.status);
                  const project = leadScopeLabel(fee.leadMatch.lead);
                  const when = relevantDate(fee);
                  const pay = fee.status === "PAID" ? paymentMethodMeta(fee.paymentMethod) : null;
                  const isDue = fee.status === "DUE";

                  return (
                    <tr
                      key={fee.id}
                      style={{
                        borderBottom: "1px solid var(--line2)",
                        background: isDue ? "color-mix(in srgb, var(--dangerBg) 35%, transparent)" : undefined,
                      }}
                    >
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        <span style={{ fontWeight: 600 }}>{project}</span>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {fee.leadMatch.lead.propertyLocation}
                        </span>
                        {fee.leadMatch.lead.landownerName && (
                          <>
                            <br />
                            <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                              {fee.leadMatch.lead.landownerName}
                            </span>
                          </>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        <span style={{ fontWeight: 600 }}>{fee.leadMatch.contractor.name}</span>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {fee.leadMatch.contractor.email}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                        {formatMoney(fee.finalValueCents)}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>{formatRate(fee.rateBasisPoints)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          color: isDue ? "var(--danger)" : "var(--ink)",
                          fontSize: 15,
                        }}
                      >
                        {formatMoney(fee.feeAmountCents)}
                      </td>
                      <td style={tdStyle}>
                        <span title={meta.hint}>
                          <Chip bg={meta.bg} fg={meta.fg} dot>
                            {meta.label}
                          </Chip>
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, color: "var(--ink3)", display: "block", marginBottom: 2 }}>
                          {when.label}
                        </span>
                        {formatDate(when.value)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {isDue ? (
                          <MarkFeePaidButton leadMatchId={fee.leadMatchId} prominent />
                        ) : pay ? (
                          <Chip bg={pay.bg} fg={pay.fg}>
                            {pay.label}
                          </Chip>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="admin-table-mobile" style={{ display: "none", flexDirection: "column" }}>
              {fees.map((fee) => {
                const meta = feeStatusMeta(fee.status);
                const project = leadScopeLabel(fee.leadMatch.lead);
                const when = relevantDate(fee);
                const pay = fee.status === "PAID" ? paymentMethodMeta(fee.paymentMethod) : null;
                const isDue = fee.status === "DUE";

                return (
                  <div
                    key={fee.id}
                    className="a-row admin-fade-up"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      padding: "18px 18px",
                      borderBottom: "1px solid var(--line2)",
                      background: isDue ? "color-mix(in srgb, var(--dangerBg) 40%, transparent)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, font: "600 15px/1.3 'Inter'", color: "var(--ink)" }}>{project}</p>
                        <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                          {fee.leadMatch.lead.propertyLocation}
                        </p>
                      </div>
                      <span title={meta.hint}>
                        <Chip bg={meta.bg} fg={meta.fg} dot>
                          {meta.short}
                        </Chip>
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        font: "400 13px/1.4 'Inter'",
                        color: "var(--ink2)",
                      }}
                    >
                      <div>
                        <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginBottom: 2 }}>
                          Contractor
                        </span>
                        {fee.leadMatch.contractor.name}
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginBottom: 2 }}>
                          Final value
                        </span>
                        {formatMoney(fee.finalValueCents)} · {formatRate(fee.rateBasisPoints)}
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginBottom: 2 }}>
                          {when.label}
                        </span>
                        {formatDate(when.value)}
                      </div>
                      {pay && (
                        <div>
                          <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginBottom: 2 }}>
                            Method
                          </span>
                          <Chip bg={pay.bg} fg={pay.fg}>
                            {pay.label}
                          </Chip>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        paddingTop: 4,
                        borderTop: isDue ? "1px solid var(--line2)" : undefined,
                        marginTop: isDue ? 2 : 0,
                      }}
                    >
                      <div>
                        <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginBottom: 2 }}>
                          Landy&apos;s fee
                        </span>
                        <p
                          style={{
                            margin: 0,
                            font: "700 20px/1 var(--display)",
                            color: isDue ? "var(--danger)" : "var(--ink)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatMoney(fee.feeAmountCents)}
                        </p>
                      </div>
                      {isDue && <MarkFeePaidButton leadMatchId={fee.leadMatchId} prominent />}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {tab === "all" && fees.length > 0 && (
        <Panel style={{ padding: "12px 16px", marginTop: 14 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 18px",
              alignItems: "center",
              font: "400 12px/1.4 'Inter'",
              color: "var(--ink3)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Chip bg="var(--goldSoft)" fg="var(--goldSoftFg)" dot>
                Awaiting
              </Chip>
              contractor not yet paid
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Chip bg="var(--dangerBg)" fg="var(--danger)" dot>
                Due
              </Chip>
              Landy&apos;s is owed
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Chip bg="var(--posBg)" fg="var(--pos)" dot>
                Paid
              </Chip>
              settled
            </span>
          </div>
        </Panel>
      )}
    </div>
  );
}
