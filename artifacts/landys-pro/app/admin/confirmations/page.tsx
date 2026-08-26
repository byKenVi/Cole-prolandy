import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { ResolveMismatchButton } from "@/components/admin/resolve-mismatch-button";
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

function outcomeLabel(outcome: string) {
  if (outcome === "WON") return "Won";
  if (outcome === "LOST") return "Lost";
  return "Open";
}

export default async function AdminConfirmationsPage() {
  const confirmations = await prisma.landownerConfirmation.findMany({
    orderBy: [{ mismatchFlagged: "desc" }, { respondedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      lead: {
        select: {
          id: true,
          landownerName: true,
          landownerEmail: true,
          propertyLocation: true,
          projectType: { select: { name: true } },
          workType: { select: { name: true } },
          matches: {
            where: { status: "ACCEPTED" },
            select: {
              id: true,
              jobOutcome: true,
              contractor: { select: { name: true } },
            },
          },
        },
      },
      hiredLeadMatch: {
        select: {
          id: true,
          contractor: { select: { name: true } },
        },
      },
    },
  });

  const flagged = confirmations.filter((c) => c.mismatchFlagged).length;
  const responded = confirmations.filter((c) => c.respondedAt).length;

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Landowner follow-up"
        title="Confirmations"
        subtitle="Landowner responses, contractor outcomes, and mismatches for admin review."
      />

      <p style={{ margin: "0 0 18px", font: "400 14px/1.5 'Inter'", color: "var(--ink2)" }}>
        {responded} responded · {flagged} need mismatch review
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
        {confirmations.length === 0 ? (
          <p style={{ padding: 20, font: "400 14px/1.5 'Inter'", color: "var(--ink3)" }}>
            No landowner confirmations yet.
          </p>
        ) : (
          <table className="admin-table-desktop" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--line)" }}>
                <th style={thStyle}>Project</th>
                <th style={thStyle}>Landowner</th>
                <th style={thStyle}>Hired?</th>
                <th style={thStyle}>Selected contractor</th>
                <th style={thStyle}>Contractor outcomes</th>
                <th style={thStyle}>Mismatch</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {confirmations.map((row) => {
                const project = leadScopeLabel(row.lead);
                const wasFlagged = Boolean(row.mismatchReason);
                const reviewed = wasFlagged && !row.mismatchFlagged;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                    <td style={{ ...tdStyle, color: "var(--ink)" }}>
                      <Link href={`/admin/leads/${row.leadId}`} style={{ color: "inherit", fontWeight: 600 }}>
                        {project}
                      </Link>
                      <br />
                      <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                        {row.lead.propertyLocation}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                      {row.lead.landownerName ?? "—"}
                      <br />
                      <span style={{ fontSize: 12 }}>{row.lead.landownerEmail}</span>
                    </td>
                    <td style={{ ...tdStyle, color: "var(--ink)" }}>
                      {row.respondedAt
                        ? row.hired
                          ? "Yes"
                          : "No / Not yet"
                        : "Pending"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                      {row.hiredLeadMatch?.contractor.name ?? "—"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>
                      {row.lead.matches.length === 0
                        ? "—"
                        : row.lead.matches.map((m) => (
                            <div key={m.id}>
                              {m.contractor.name}: {outcomeLabel(m.jobOutcome)}
                            </div>
                          ))}
                    </td>
                    <td style={{ ...tdStyle }}>
                      {row.mismatchFlagged ? (
                        <span style={{ color: "var(--gold)", fontWeight: 600 }}>Needs review</span>
                      ) : reviewed ? (
                        <span style={{ color: "var(--sageFg)" }}>Reviewed</span>
                      ) : (
                        <span style={{ color: "var(--ink3)" }}>—</span>
                      )}
                      {row.mismatchReason && (
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink3)" }}>
                          {row.mismatchReason}
                        </p>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {row.mismatchFlagged ? (
                        <ResolveMismatchButton confirmationId={row.id} />
                      ) : row.respondedAt ? (
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {formatDate(row.respondedAt)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
