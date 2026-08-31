import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Chip, Panel } from "@/components/admin/ui";
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
  padding: "13px 20px",
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
  bg: string;
  fg: string;
} {
  switch (status) {
    case "AWAITING_CONTRACTOR_PAYMENT":
      return {
        label: "Awaiting contractor payment",
        short: "Awaiting",
        bg: "var(--goldSoft)",
        fg: "var(--goldSoftFg)",
      };
    case "DUE":
      return {
        label: "Due",
        short: "Due",
        bg: "var(--dangerBg)",
        fg: "var(--danger)",
      };
    case "PAID":
      return {
        label: "Paid",
        short: "Paid",
        bg: "var(--posBg)",
        fg: "var(--pos)",
      };
    default:
      return { label: status, short: status, bg: "var(--chipBg)", fg: "var(--ink3)" };
  }
}

function formatRate(bps: number): string {
  const pct = bps / 100;
  return pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "Paid";
  if (method === "manual") return "Manual";
  if (method === "stripe") return "Stripe";
  return method;
}

function relevantDate(fee: {
  status: string;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}): { label: string; value: Date } {
  if (fee.status === "PAID" && fee.paidAt) return { label: "Paid", value: fee.paidAt };
  if (fee.status === "DUE" && fee.dueAt) return { label: "Due", value: fee.dueAt };
  if (fee.dueAt) return { label: "Due", value: fee.dueAt };
  return { label: "Created", value: fee.createdAt };
}

function emptyMessage(tab: FeeTab): string {
  switch (tab) {
    case "awaiting":
      return "No fees awaiting contractor payment.";
    case "due":
      return "No fees are due right now.";
    case "paid":
      return "No paid fees yet.";
    default:
      return "No success fees yet. Fees appear here after contractors report won jobs.";
  }
}

function TabLink({
  href,
  active,
  children,
  count,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        textDecoration: "none",
        border: "none",
        font: "600 13px/1 'Inter'",
        padding: "9px 15px",
        borderRadius: 9,
        background: active ? "var(--card)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink2)",
        boxShadow: active ? "0 1px 3px rgba(58,53,45,.14)" : "none",
      }}
    >
      {children}
      {typeof count === "number" && (
        <span
          style={{
            font: "600 11px/1 var(--mono)",
            color: active ? "var(--gold)" : "var(--ink3)",
            background: active ? "var(--goldSoft)" : "var(--chipBg)",
            padding: "3px 7px",
            borderRadius: 999,
          }}
        >
          {count}
        </span>
      )}
    </Link>
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

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Success fees"
        title="Fees"
        subtitle="Track success fees from won jobs through contractor payment confirmation and settlement with Landy's."
      />

      <Panel style={{ padding: "14px 18px", marginBottom: 18 }}>
        <p
          style={{
            margin: "0 0 10px",
            font: "600 10px/1 var(--mono)",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--ink3)",
          }}
        >
          Status legend
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
            <strong style={{ color: "var(--goldSoftFg)" }}>Awaiting contractor payment</strong>
            {" — "}
            contractor won but hasn&apos;t confirmed the landowner paid them.
          </p>
          <p style={{ margin: 0, font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
            <strong style={{ color: "var(--danger)" }}>Due</strong>
            {" — "}
            contractor confirmed paid; fee is owed to Landy&apos;s.
          </p>
          <p style={{ margin: 0, font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
            <strong style={{ color: "var(--sageFg)" }}>Paid</strong>
            {" — "}
            settled via Stripe or marked paid manually.
          </p>
        </div>
      </Panel>

      <div
        style={{
          display: "flex",
          gap: 3,
          background: "var(--card2)",
          padding: 4,
          borderRadius: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          width: "fit-content",
          maxWidth: "100%",
        }}
      >
        <TabLink href="/admin/fees?tab=all" active={tab === "all"} count={allCount}>
          All
        </TabLink>
        <TabLink href="/admin/fees?tab=awaiting" active={tab === "awaiting"} count={awaitingCount}>
          Awaiting Contractor Payment
        </TabLink>
        <TabLink href="/admin/fees?tab=due" active={tab === "due"} count={dueCount}>
          Due
        </TabLink>
        <TabLink href="/admin/fees?tab=paid" active={tab === "paid"} count={paidCount}>
          Paid
        </TabLink>
      </div>

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
          <p style={{ padding: "28px 24px", font: "400 14px/1.5 'Inter'", color: "var(--ink3)", textAlign: "center" }}>
            {emptyMessage(tab)}
          </p>
        ) : (
          <>
            <table className="admin-table-desktop" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Contractor</th>
                  <th style={thStyle}>Landowner</th>
                  <th style={thStyle}>Final value</th>
                  <th style={thStyle}>Rate</th>
                  <th style={thStyle}>Landy&apos;s fee</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => {
                  const meta = feeStatusMeta(fee.status);
                  const project = leadScopeLabel(fee.leadMatch.lead);
                  const when = relevantDate(fee);
                  return (
                    <tr key={fee.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        <span style={{ fontWeight: 600 }}>{project}</span>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {fee.leadMatch.lead.propertyLocation}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        <span style={{ fontWeight: 600 }}>{fee.leadMatch.contractor.name}</span>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {fee.leadMatch.contractor.email}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                        {fee.leadMatch.lead.landownerName ?? "—"}
                      </td>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                        {formatMoney(fee.finalValueCents)}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>{formatRate(fee.rateBasisPoints)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--ink)",
                        }}
                      >
                        {formatMoney(fee.feeAmountCents)}
                      </td>
                      <td style={tdStyle}>
                        <Chip bg={meta.bg} fg={meta.fg} dot>
                          {meta.label}
                        </Chip>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, color: "var(--ink3)", display: "block", marginBottom: 2 }}>
                          {when.label}
                        </span>
                        {formatDate(when.value)}
                        {fee.status === "PAID" && fee.paymentMethod && (
                          <>
                            <br />
                            <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                              {paymentMethodLabel(fee.paymentMethod)}
                            </span>
                          </>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {fee.status === "DUE" ? (
                          <MarkFeePaidButton leadMatchId={fee.leadMatchId} />
                        ) : fee.status === "PAID" ? (
                          <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                            {paymentMethodLabel(fee.paymentMethod)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--ink3)" }}>—</span>
                        )}
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
                return (
                  <div
                    key={fee.id}
                    className="a-row admin-fade-up"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: "16px 18px",
                      borderBottom: "1px solid var(--line2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, font: "600 15px/1.3 'Inter'", color: "var(--ink)" }}>{project}</p>
                        <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                          {fee.leadMatch.lead.propertyLocation}
                        </p>
                      </div>
                      <Chip bg={meta.bg} fg={meta.fg} dot>
                        {meta.short}
                      </Chip>
                    </div>

                    <div style={{ display: "grid", gap: 6, font: "400 13px/1.4 'Inter'", color: "var(--ink2)" }}>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Contractor · </span>
                        {fee.leadMatch.contractor.name}
                        <span style={{ color: "var(--ink3)" }}> · {fee.leadMatch.contractor.email}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Landowner · </span>
                        {fee.leadMatch.lead.landownerName ?? "—"}
                      </div>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Final value · </span>
                        {formatMoney(fee.finalValueCents)}
                        <span style={{ color: "var(--ink3)" }}> · Rate · </span>
                        {formatRate(fee.rateBasisPoints)}
                      </div>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>{when.label} · </span>
                        {formatDate(when.value)}
                        {fee.status === "PAID" && fee.paymentMethod && (
                          <span style={{ color: "var(--ink3)" }}>
                            {" · "}
                            {paymentMethodLabel(fee.paymentMethod)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <p
                        style={{
                          margin: 0,
                          font: "600 18px/1 var(--display)",
                          color: "var(--ink)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMoney(fee.feeAmountCents)}
                      </p>
                      {fee.status === "DUE" ? (
                        <MarkFeePaidButton leadMatchId={fee.leadMatchId} />
                      ) : fee.status === "PAID" ? (
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {paymentMethodLabel(fee.paymentMethod)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
