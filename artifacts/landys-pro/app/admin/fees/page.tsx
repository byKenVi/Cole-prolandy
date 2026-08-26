import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { MarkFeePaidButton } from "@/components/admin/mark-fee-paid-button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { leadScopeLabel } from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

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
  font: "400 14px/1 'Inter'",
};

function statusLabel(status: string) {
  if (status === "DUE") return { text: "Due", color: "var(--gold)" };
  if (status === "PAID") return { text: "Paid", color: "var(--sageFg)" };
  return { text: status, color: "var(--ink2)" };
}

export default async function AdminFeesPage() {
  const fees = await prisma.successFee.findMany({
    where: { status: { in: ["DUE", "PAID"] } },
    orderBy: [{ status: "asc" }, { dueAt: "desc" }, { createdAt: "desc" }],
    include: {
      leadMatch: {
        include: {
          contractor: { select: { name: true, email: true } },
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
    take: 100,
  });

  const dueCount = fees.filter((f) => f.status === "DUE").length;
  const paidCount = fees.filter((f) => f.status === "PAID").length;
  const dueTotal = fees.filter((f) => f.status === "DUE").reduce((s, f) => s + f.feeAmountCents, 0);
  const paidTotal = fees.filter((f) => f.status === "PAID").reduce((s, f) => s + f.feeAmountCents, 0);

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Success fees"
        title="Fees"
        subtitle="Contractor success fees after won jobs. Mark fees paid when collected outside Stripe."
      />

      <div
        className="admin-grid-tight"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatCard label="Due" value={formatMoney(dueTotal)} sub={`${dueCount} fee${dueCount === 1 ? "" : "s"} outstanding`} />
        <StatCard label="Paid" value={formatMoney(paidTotal)} sub={`${paidCount} fee${paidCount === 1 ? "" : "s"} collected`} valueColor="var(--sageFg)" />
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
          <p style={{ padding: 20, font: "400 14px/1.5 'Inter'", color: "var(--ink3)" }}>
            No success fees yet. Fees appear here after contractors report won jobs and confirm payment.
          </p>
        ) : (
          <>
            <table className="admin-table-desktop" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={thStyle}>Contractor</th>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Final value</th>
                  <th style={thStyle}>Fee</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Due / paid</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => {
                  const chip = statusLabel(fee.status);
                  const project = leadScopeLabel(fee.leadMatch.lead);
                  const date = fee.paidAt ?? fee.dueAt;
                  return (
                    <tr key={fee.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        <span style={{ fontWeight: 600 }}>{fee.leadMatch.contractor.name}</span>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {fee.leadMatch.contractor.email}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                        {project}
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {fee.leadMatch.lead.propertyLocation}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                        {formatMoney(fee.finalValueCents)}
                      </td>
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
                      <td style={{ ...tdStyle, fontWeight: 600, color: chip.color }}>{chip.text}</td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                        {date ? formatDate(date) : "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {fee.status === "DUE" ? (
                          <MarkFeePaidButton leadMatchId={fee.leadMatchId} />
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                            {fee.paymentMethod ?? "paid"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
