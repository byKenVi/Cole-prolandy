import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Chip, Panel } from "@/components/admin/ui";
import { ResolveMismatchButton } from "@/components/admin/resolve-mismatch-button";
import { formatDate } from "@/lib/format";
import { leadScopeLabel } from "@/lib/resolved-lead";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ConfirmationTab = "pending" | "confirmed" | "mismatches" | "all";

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

function parseTab(raw: string | undefined): ConfirmationTab {
  if (raw === "pending" || raw === "confirmed" || raw === "mismatches" || raw === "all") return raw;
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
    default:
      return {};
  }
}

function outcomeLabel(outcome: string): string {
  if (outcome === "WON") return "Won";
  if (outcome === "LOST") return "Lost";
  return "Open";
}

function emptyMessage(tab: ConfirmationTab): string {
  switch (tab) {
    case "pending":
      return "No pending landowner confirmations.";
    case "confirmed":
      return "No confirmed responses yet.";
    case "mismatches":
      return "No mismatches to review.";
    default:
      return "No landowner confirmations yet.";
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

function getConfirmationDetails(row: ConfirmationRow) {
  const project = leadScopeLabel(row.lead);
  const chip = statusChip(row);
  const wonNames = row.lead.matches
    .filter((m) => m.jobOutcome === "WON")
    .map((m) => m.contractor.name);
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

  return {
    project,
    chip,
    wonNames,
    hiredName,
    reviewed,
    mismatchText,
  };
}

export default async function AdminConfirmationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab = parseTab(tabRaw);

  const [pendingCount, confirmedCount, mismatchCount, allCount, confirmations] = await Promise.all([
    prisma.landownerConfirmation.count({ where: { respondedAt: null } }),
    prisma.landownerConfirmation.count({
      where: { respondedAt: { not: null }, mismatchFlagged: false },
    }),
    prisma.landownerConfirmation.count({ where: { mismatchFlagged: true } }),
    prisma.landownerConfirmation.count(),
    prisma.landownerConfirmation.findMany({
      where: tabWhere(tab),
      orderBy: [{ mismatchFlagged: "desc" }, { respondedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: confirmationInclude,
    }),
  ]);

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Landowner follow-up"
        title="Confirmations"
        subtitle="Compare landowner responses with contractor-reported outcomes and review mismatches."
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
          How to read this page
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
            <strong style={{ color: "var(--goldSoftFg)" }}>Pending</strong>
            {" — "}
            waiting for the landowner to respond.
          </p>
          <p style={{ margin: 0, font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
            <strong style={{ color: "var(--sageFg)" }}>Confirmed</strong>
            {" — "}
            landowner responded with no open mismatch.
          </p>
          <p style={{ margin: 0, font: "400 13px/1.45 'Inter'", color: "var(--ink2)" }}>
            <strong style={{ color: "var(--danger)" }}>Mismatch</strong>
            {" — "}
            landowner selection disagrees with a contractor who claimed Won (or similar conflict).
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
        <TabLink href="/admin/confirmations?tab=pending" active={tab === "pending"} count={pendingCount}>
          Pending
        </TabLink>
        <TabLink
          href="/admin/confirmations?tab=confirmed"
          active={tab === "confirmed"}
          count={confirmedCount}
        >
          Confirmed
        </TabLink>
        <TabLink
          href="/admin/confirmations?tab=mismatches"
          active={tab === "mismatches"}
          count={mismatchCount}
        >
          Mismatches
        </TabLink>
        <TabLink href="/admin/confirmations?tab=all" active={tab === "all"} count={allCount}>
          All
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
        {confirmations.length === 0 ? (
          <p style={{ padding: "28px 24px", font: "400 14px/1.5 'Inter'", color: "var(--ink3)", textAlign: "center" }}>
            {emptyMessage(tab)}
          </p>
        ) : (
          <>
            <table className="admin-table-desktop" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--line)" }}>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Landowner</th>
                  <th style={thStyle}>Connected contractors</th>
                  <th style={thStyle}>Reported outcomes</th>
                  <th style={thStyle}>Landowner selected</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Response</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {confirmations.map((row) => {
                  const d = getConfirmationDetails(row);
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        <Link
                          href={`/admin/leads/${row.leadId}`}
                          style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}
                        >
                          {d.project}
                        </Link>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {row.lead.propertyLocation}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                        {row.lead.landownerName ?? "—"}
                        <br />
                        <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                          {row.lead.landownerEmail}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>
                        {row.lead.matches.length === 0
                          ? "—"
                          : row.lead.matches.map((m) => (
                              <div key={m.id}>{m.contractor.name}</div>
                            ))}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>
                        {row.lead.matches.length === 0
                          ? "—"
                          : row.lead.matches.map((m) => (
                              <div key={m.id}>
                                {m.contractor.name}:{" "}
                                <span
                                  style={{
                                    fontWeight: m.jobOutcome === "WON" ? 600 : 400,
                                    color:
                                      m.jobOutcome === "WON"
                                        ? "var(--sageFg)"
                                        : m.jobOutcome === "LOST"
                                          ? "var(--ink3)"
                                          : "var(--ink2)",
                                  }}
                                >
                                  {outcomeLabel(m.jobOutcome)}
                                </span>
                              </div>
                            ))}
                        {d.wonNames.length > 0 && (
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink3)" }}>
                            Claimed Won: {d.wonNames.join(", ")}
                          </p>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink)" }}>
                        {row.respondedAt
                          ? row.hired
                            ? (d.hiredName ?? "Hired (contractor unknown)")
                            : "No / not yet"
                          : "—"}
                      </td>
                      <td style={tdStyle}>
                        <Chip bg={d.chip.bg} fg={d.chip.fg} dot>
                          {d.chip.label}
                        </Chip>
                        {!row.respondedAt && (
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink3)" }}>
                            Waiting for landowner response.
                          </p>
                        )}
                        {d.reviewed && (
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--sageFg)" }}>
                            Reviewed
                          </p>
                        )}
                        {d.mismatchText && (row.mismatchFlagged || d.reviewed) && (
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink3)", maxWidth: 260 }}>
                            {d.mismatchText}
                          </p>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", whiteSpace: "nowrap" }}>
                        {row.respondedAt ? formatDate(row.respondedAt) : "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {row.mismatchFlagged ? (
                          <ResolveMismatchButton confirmationId={row.id} />
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
              {confirmations.map((row) => {
                const d = getConfirmationDetails(row);
                return (
                  <div
                    key={row.id}
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
                        <Link
                          href={`/admin/leads/${row.leadId}`}
                          style={{
                            margin: 0,
                            font: "600 15px/1.3 'Inter'",
                            color: "var(--ink)",
                            textDecoration: "none",
                          }}
                        >
                          {d.project}
                        </Link>
                        <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'Inter'", color: "var(--ink3)" }}>
                          {row.lead.propertyLocation}
                        </p>
                      </div>
                      <Chip bg={d.chip.bg} fg={d.chip.fg} dot>
                        {d.chip.label}
                      </Chip>
                    </div>

                    <div style={{ display: "grid", gap: 6, font: "400 13px/1.4 'Inter'", color: "var(--ink2)" }}>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Landowner · </span>
                        {row.lead.landownerName ?? "—"}
                        {row.lead.landownerEmail ? (
                          <span style={{ color: "var(--ink3)" }}> · {row.lead.landownerEmail}</span>
                        ) : null}
                      </div>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Connected · </span>
                        {row.lead.matches.length === 0
                          ? "—"
                          : row.lead.matches.map((m) => m.contractor.name).join(", ")}
                      </div>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Outcomes · </span>
                        {row.lead.matches.length === 0
                          ? "—"
                          : row.lead.matches
                              .map((m) => `${m.contractor.name}: ${outcomeLabel(m.jobOutcome)}`)
                              .join(" · ")}
                      </div>
                      {d.wonNames.length > 0 && (
                        <div>
                          <span style={{ color: "var(--ink3)" }}>Claimed Won · </span>
                          {d.wonNames.join(", ")}
                        </div>
                      )}
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Selected · </span>
                        {row.respondedAt
                          ? row.hired
                            ? (d.hiredName ?? "Hired (contractor unknown)")
                            : "No / not yet"
                          : "Waiting for landowner response."}
                      </div>
                      <div>
                        <span style={{ color: "var(--ink3)" }}>Response · </span>
                        {row.respondedAt ? formatDate(row.respondedAt) : "—"}
                      </div>
                      {d.mismatchText && (row.mismatchFlagged || d.reviewed) && (
                        <p style={{ margin: 0, fontSize: 12, color: "var(--ink3)" }}>{d.mismatchText}</p>
                      )}
                    </div>

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
