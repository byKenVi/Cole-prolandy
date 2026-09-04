import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Chip,
  Panel,
  AdminTabBar,
  AdminTabLink,
  AdminEmptyState,
} from "@/components/admin/ui";
import { ResolveMismatchButton } from "@/components/admin/resolve-mismatch-button";
import { formatDate } from "@/lib/format";
import { leadScopeLabel } from "@/lib/resolved-lead";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ConfirmationTab = "pending" | "confirmed" | "mismatches";

const thStyle: React.CSSProperties = {
  padding: "12px 18px",
  textAlign: "left",
  font: "600 10px/1 var(--mono)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 18px",
  font: "400 14px/1.35 'Inter'",
  verticalAlign: "top",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  font: "600 10px/1 var(--mono)",
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "var(--ink3)",
  marginBottom: 4,
};

function parseTab(raw: string | undefined): ConfirmationTab {
  if (raw === "pending" || raw === "confirmed" || raw === "mismatches") return raw;
  return "pending";
}

function tabWhere(tab: ConfirmationTab): Prisma.LandownerConfirmationWhereInput {
  switch (tab) {
    case "pending":
      return { respondedAt: null };
    case "confirmed":
      return { respondedAt: { not: null }, mismatchFlagged: false };
    case "mismatches":
      return { mismatchFlagged: true };
  }
}

function outcomeLabel(outcome: string): string {
  if (outcome === "WON") return "Won";
  if (outcome === "LOST") return "Lost";
  return "Open";
}

function emptyCopy(tab: ConfirmationTab): { title: string; description: string } {
  switch (tab) {
    case "pending":
      return {
        title: "No pending confirmations",
        description: "When landowners are asked who they hired, unanswered follow-ups show up here.",
      };
    case "confirmed":
      return {
        title: "No confirmations yet",
        description: "Landowner responses that match contractor claims land in this list.",
      };
    case "mismatches":
      return {
        title: "No mismatches",
        description: "Conflicts between contractor claims and landowner answers will appear here for review.",
      };
  }
}

function humanMismatchReason(params: {
  mismatchReason: string | null;
  wonNames: string[];
  hiredName: string | null;
}): string {
  const { mismatchReason, wonNames, hiredName } = params;
  const wonLabel =
    wonNames.length === 0
      ? "A contractor"
      : wonNames.length === 1
        ? wonNames[0]
        : wonNames.slice(0, -1).join(", ") + " and " + wonNames[wonNames.length - 1];

  if (wonNames.length > 0 && hiredName && !wonNames.includes(hiredName)) {
    return `${wonLabel} reported this job as Won, but the landowner selected ${hiredName}.`;
  }

  if (mismatchReason === "Contractor reported won but landowner did not hire.") {
    return `${wonLabel} reported this job as Won, but the landowner said they did not hire anyone.`;
  }

  if (mismatchReason === "Landowner hired a contractor who reported lost.") {
    return hiredName
      ? `The landowner selected ${hiredName}, who had reported the job as Lost.`
      : "The landowner hired a contractor who reported the job as Lost.";
  }

  if (mismatchReason === "Landowner hired a different contractor than one who reported won.") {
    return hiredName
      ? `${wonLabel} reported this job as Won, but the landowner selected ${hiredName}.`
      : `${wonLabel} reported this job as Won, but the landowner selected a different contractor.`;
  }

  return mismatchReason ?? "Mismatch flagged for review.";
}

function tabHint(tab: ConfirmationTab): string {
  switch (tab) {
    case "pending":
      return "Waiting on the landowner — no response yet.";
    case "confirmed":
      return "Landowner answered, and it lines up with contractor claims.";
    case "mismatches":
      return "Stories don't match. Review and mark resolved when you've sorted it out.";
  }
}

const confirmationInclude = {
  lead: {
    select: {
      id: true,
      landownerName: true,
      landownerEmail: true,
      propertyLocation: true,
      projectType: { select: { name: true } },
      workType: { select: { name: true } },
      matches: {
        where: { status: "ACCEPTED" as const },
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
} satisfies Prisma.LandownerConfirmationInclude;

type ConfirmationRow = Prisma.LandownerConfirmationGetPayload<{ include: typeof confirmationInclude }>;

function statusChip(row: ConfirmationRow): { label: string; bg: string; fg: string } {
  if (row.mismatchFlagged) {
    return { label: "Mismatch", bg: "var(--dangerBg)", fg: "var(--danger)" };
  }
  if (!row.respondedAt) {
    return { label: "Pending", bg: "var(--goldSoft)", fg: "var(--goldSoftFg)" };
  }
  return { label: "Confirmed", bg: "var(--posBg)", fg: "var(--pos)" };
}

function contractorClaimSummary(matches: ConfirmationRow["lead"]["matches"]): {
  wonNames: string[];
  lines: { id: string; name: string; outcome: string }[];
} {
  const wonNames = matches.filter((m) => m.jobOutcome === "WON").map((m) => m.contractor.name);
  const lines = matches.map((m) => ({
    id: m.id,
    name: m.contractor.name,
    outcome: m.jobOutcome,
  }));
  return { wonNames, lines };
}

function landownerConfirmationText(row: ConfirmationRow, hiredName: string | null): string {
  if (!row.respondedAt) return "Waiting for response";
  if (row.hired) return hiredName ? `Paid ${hiredName}` : "Paid a contractor";
  return "Not yet paid";
}

function ConfirmEmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export default async function AdminConfirmationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab = parseTab(tabRaw);

  const [pendingCount, confirmedCount, mismatchCount, confirmations] = await Promise.all([
    prisma.landownerConfirmation.count({ where: { respondedAt: null } }),
    prisma.landownerConfirmation.count({
      where: { respondedAt: { not: null }, mismatchFlagged: false },
    }),
    prisma.landownerConfirmation.count({ where: { mismatchFlagged: true } }),
    prisma.landownerConfirmation.findMany({
      where: tabWhere(tab),
      orderBy: [{ mismatchFlagged: "desc" }, { respondedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: confirmationInclude,
    }),
  ]);

  const empty = emptyCopy(tab);

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Trust check"
        title="Confirmations"
        subtitle="Landowners confirm whether they paid a contractor. Review mismatches before a success fee sticks."
      />

      <Panel
        style={{
          padding: "14px 18px",
          marginBottom: 18,
          background: "linear-gradient(135deg, var(--card) 0%, var(--card2) 100%)",
        }}
      >
        <p style={{ margin: 0, font: "500 14px/1.5 'Inter'", color: "var(--ink2)" }}>
          Contractors report outcomes. Landowners confirm payment.{" "}
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>When those disagree, you review here.</span>
        </p>
      </Panel>

      <AdminTabBar aria-label="Confirmation status">
        <AdminTabLink
          href="/admin/confirmations?tab=pending"
          active={tab === "pending"}
          count={pendingCount}
          tone="gold"
        >
          Pending
        </AdminTabLink>
        <AdminTabLink
          href="/admin/confirmations?tab=confirmed"
          active={tab === "confirmed"}
          count={confirmedCount}
          tone="pos"
        >
          Confirmed
        </AdminTabLink>
        <AdminTabLink
          href="/admin/confirmations?tab=mismatches"
          active={tab === "mismatches"}
          count={mismatchCount}
          tone="danger"
        >
          Mismatches
        </AdminTabLink>
      </AdminTabBar>

      <p
        style={{
          margin: "-6px 0 16px",
          font: "400 13px/1.45 'Inter'",
          color: "var(--ink3)",
          maxWidth: 560,
        }}
      >
        {tabHint(tab)}
      </p>

      <div
        style={{
          overflowX: "auto",
          borderRadius: 16,
          border: "1px solid var(--line)",
          background: "var(--card)",
          boxShadow: "var(--shadow)",
        }}
      >
        {confirmations.length === 0 ? (
          <AdminEmptyState title={empty.title} description={empty.description} icon={<ConfirmEmptyIcon />} />
        ) : (
          <>
            <table className="admin-table-desktop" style={{ width: "100%", minWidth: 920, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Landowner</th>
                  <th style={thStyle}>Contractors connected</th>
                  <th style={thStyle}>Contractor claim</th>
                  <th style={thStyle}>Landowner confirmation</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>
                    {tab === "mismatches" ? "Review" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {confirmations.map((row) => {
                  const project = leadScopeLabel(row.lead);
                  const chip = statusChip(row);
                  const { wonNames, lines } = contractorClaimSummary(row.lead.matches);
                  const hiredName = row.hiredLeadMatch?.contractor.name ?? null;
                  const wasFlagged = Boolean(row.mismatchReason);
                  const reviewed = wasFlagged && !row.mismatchFlagged;
                  const mismatchText =
                    row.mismatchFlagged || wasFlagged
                      ? humanMismatchReason({
                          mismatchReason: row.mismatchReason,
                          wonNames,
                          hiredName,
                        })
                      : null;
                  const confirmation = landownerConfirmationText(row, hiredName);

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: "1px solid var(--line2)",
                        background: row.mismatchFlagged
                          ? "color-mix(in srgb, var(--dangerBg) 32%, transparent)"
                          : undefined,
                      }}
                    >
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        <Link
                          href={`/admin/leads/${row.leadId}`}
                          style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}
                        >
                          {project}
                        </Link>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {row.lead.propertyLocation}
                        </span>
                        <div style={{ marginTop: 8 }}>
                          <Chip bg={chip.bg} fg={chip.fg} dot>
                            {chip.label}
                          </Chip>
                          {reviewed && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--sageFg)" }}>
                              Reviewed
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                          {row.lead.landownerName ?? "—"}
                        </span>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {row.lead.landownerEmail}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>
                        {row.lead.matches.length === 0
                          ? "—"
                          : row.lead.matches.map((m) => (
                              <div key={m.id} style={{ marginBottom: 2 }}>
                                {m.contractor.name}
                              </div>
                            ))}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>
                        {lines.length === 0 ? (
                          "—"
                        ) : (
                          lines.map((line) => (
                            <div key={line.id} style={{ marginBottom: 3 }}>
                              <span style={{ color: "var(--ink3)" }}>{line.name}: </span>
                              <span
                                style={{
                                  fontWeight: line.outcome === "WON" ? 700 : 400,
                                  color:
                                    line.outcome === "WON"
                                      ? "var(--sageFg)"
                                      : line.outcome === "LOST"
                                        ? "var(--ink3)"
                                        : "var(--ink2)",
                                }}
                              >
                                {outcomeLabel(line.outcome)}
                              </span>
                            </div>
                          ))
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink)", maxWidth: 280 }}>
                        <span style={{ fontWeight: 600 }}>{confirmation}</span>
                        {row.respondedAt && (
                          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--ink3)" }}>
                            {formatDate(row.respondedAt)}
                          </span>
                        )}
                        {mismatchText && (row.mismatchFlagged || reviewed) && (
                          <p
                            style={{
                              margin: "10px 0 0",
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: row.mismatchFlagged ? "var(--dangerBg)" : "var(--card2)",
                              color: row.mismatchFlagged ? "var(--danger)" : "var(--ink2)",
                              font: "500 13px/1.45 'Inter'",
                            }}
                          >
                            {mismatchText}
                          </p>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {row.mismatchFlagged ? (
                          <ResolveMismatchButton confirmationId={row.id} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="admin-table-mobile" style={{ display: "none", flexDirection: "column" }}>
              {confirmations.map((row) => {
                const project = leadScopeLabel(row.lead);
                const chip = statusChip(row);
                const { wonNames, lines } = contractorClaimSummary(row.lead.matches);
                const hiredName = row.hiredLeadMatch?.contractor.name ?? null;
                const wasFlagged = Boolean(row.mismatchReason);
                const reviewed = wasFlagged && !row.mismatchFlagged;
                const mismatchText =
                  row.mismatchFlagged || wasFlagged
                    ? humanMismatchReason({
                        mismatchReason: row.mismatchReason,
                        wonNames,
                        hiredName,
                      })
                    : null;
                const confirmation = landownerConfirmationText(row, hiredName);

                return (
                  <div
                    key={row.id}
                    className="a-row admin-fade-up"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                      padding: "18px",
                      borderBottom: "1px solid var(--line2)",
                      background: row.mismatchFlagged
                        ? "color-mix(in srgb, var(--dangerBg) 40%, transparent)"
                        : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <Link
                          href={`/admin/leads/${row.leadId}`}
                          style={{
                            margin: 0,
                            font: "600 15px/1.3 'Inter'",
                            color: "var(--ink)",
                            textDecoration: "none",
                          }}
                        >
                          {project}
                        </Link>
                        <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                          {row.lead.propertyLocation}
                        </p>
                      </div>
                      <Chip bg={chip.bg} fg={chip.fg} dot>
                        {chip.label}
                      </Chip>
                    </div>

                    <div>
                      <span style={fieldLabel}>Landowner</span>
                      <p style={{ margin: 0, font: "500 14px/1.35 'Inter'", color: "var(--ink)" }}>
                        {row.lead.landownerName ?? "—"}
                      </p>
                      <p style={{ margin: "2px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                        {row.lead.landownerEmail}
                      </p>
                    </div>

                    <div>
                      <span style={fieldLabel}>Contractors connected</span>
                      <p style={{ margin: 0, font: "400 13px/1.4 'Inter'", color: "var(--ink2)" }}>
                        {row.lead.matches.length === 0
                          ? "—"
                          : row.lead.matches.map((m) => m.contractor.name).join(", ")}
                      </p>
                    </div>

                    <div>
                      <span style={fieldLabel}>Contractor claim</span>
                      {lines.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--ink3)" }}>—</p>
                      ) : (
                        lines.map((line) => (
                          <p key={line.id} style={{ margin: "0 0 2px", font: "400 13px/1.4 'Inter'", color: "var(--ink2)" }}>
                            {line.name}:{" "}
                            <strong
                              style={{
                                color:
                                  line.outcome === "WON"
                                    ? "var(--sageFg)"
                                    : line.outcome === "LOST"
                                      ? "var(--ink3)"
                                      : "var(--ink)",
                              }}
                            >
                              {outcomeLabel(line.outcome)}
                            </strong>
                          </p>
                        ))
                      )}
                    </div>

                    <div>
                      <span style={fieldLabel}>Landowner confirmation</span>
                      <p style={{ margin: 0, font: "600 14px/1.35 'Inter'", color: "var(--ink)" }}>
                        {confirmation}
                      </p>
                      {row.respondedAt && (
                        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--ink3)" }}>
                          {formatDate(row.respondedAt)}
                        </p>
                      )}
                    </div>

                    {mismatchText && (row.mismatchFlagged || reviewed) && (
                      <p
                        style={{
                          margin: 0,
                          padding: "12px 14px",
                          borderRadius: 10,
                          background: row.mismatchFlagged ? "var(--dangerBg)" : "var(--card2)",
                          color: row.mismatchFlagged ? "var(--danger)" : "var(--ink2)",
                          font: "500 13px/1.45 'Inter'",
                        }}
                      >
                        {mismatchText}
                      </p>
                    )}

                    {row.mismatchFlagged && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <ResolveMismatchButton confirmationId={row.id} />
                      </div>
                    )}
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
