import { Prisma } from "@prisma/client";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader, GoldButtonLink, StatCard, Chip } from "@/components/admin/ui";
import { ContractorFilters } from "@/components/admin/contractor-filters";
import { ContractorRowActions } from "@/components/admin/contractor-row-actions";
import { RowLink } from "@/components/admin/row-link";
import { PaginationControls } from "@/components/pagination-controls";
import { formatMoney } from "@/lib/money";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage, parsePageSize } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const AVATAR_BG = ["#5A5142", "#2F4A3C", "#7A5A2E", "#4A4557", "#6B4A3A"];

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default async function AdminContractors({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string; pageSize?: string }>;
}) {
  const { q, filter, page: pageRaw, pageSize: pageSizeRaw } = await searchParams;
  const requestedPage = parsePage(pageRaw);
  const pageSize = parsePageSize(pageSizeRaw, DEFAULT_PAGE_SIZE, [10, 20, 50]);

  const where: Prisma.ContractorWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter === "deactivated") where.deactivatedAt = { not: null };
  else where.deactivatedAt = null;

  const [filteredCount, totalCount, proCount, walletAgg] = await Promise.all([
    prisma.contractor.count({ where }),
    prisma.contractor.count(),
    prisma.contractor.count({ where: { isPro: true } }),
    prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
  ]);

  const { page, skip, take, totalPages } = paginationMeta(
    filteredCount,
    requestedPage,
    pageSize,
  );

  const contractors = await prisma.contractor.findMany({
    where,
    orderBy: { name: "asc" },
    skip,
    take,
    include: { contractorType: { select: { name: true } } },
  });

  // Build the export URL — mirrors the current search/filter so the CSV matches the view.
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (filter) exportParams.set("filter", filter);
  const exportHref = `/api/admin/export-contractors${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Network"
        title="Contractors"
        subtitle="The pros who receive and accept your leads."
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a
              href={exportHref}
              download
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 40,
                padding: "0 16px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                font: "600 13px/1 'Inter'",
                color: "var(--ink2)",
                textDecoration: "none",
                transition: "background 0.15s",
                cursor: "pointer",
              }}
            >
              <Download style={{ width: 14, height: 14 }} aria-hidden />
              Export CSV
            </a>
            <GoldButtonLink href="/admin/contractors/new">New contractor</GoldButtonLink>
          </div>
        }
      />

      <div
        className="admin-stat-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}
      >
        <StatCard label="Total contractors" value={String(totalCount)} />
        <StatCard label="On Pro plan" value={String(proCount)} valueColor="var(--sageFg)" />
        <StatCard
          label="Wallet balances"
          value={formatMoney(walletAgg._sum.walletBalanceCents ?? 0)}
        />
      </div>

      <ContractorFilters q={q ?? ""} filter={filter ?? ""} />

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        {contractors.length === 0 ? (
          <p style={{ padding: "28px 24px", color: "var(--ink3)", fontSize: 14, textAlign: "center" }}>
            No contractors found.
          </p>
        ) : (
          contractors.map((c, i) => (
            <div
              key={c.id}
              className="a-row admin-fade-up"
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "15px 24px",
                borderBottom: "1px solid var(--line2)",
                flexWrap: "wrap",
              }}
            >
              <RowLink href={`/admin/contractors/${c.id}`} label={`Open ${c.name}`} />
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 220px" }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: AVATAR_BG[i % AVATAR_BG.length],
                    color: "#F1E7D6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: "600 14px/1 'Inter'",
                    flex: "none",
                  }}
                >
                  {initials(c.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ font: "600 15px/1.2 'Inter'", color: "var(--ink)" }}>
                      {c.name}
                    </span>
                    {c.isPro ? (
                      <Chip bg="var(--goldSoft)" fg="var(--goldSoftFg)">
                        PRO
                      </Chip>
                    ) : (
                      <Chip bg="var(--chipBg)" fg="var(--ink3)">
                        FREE
                      </Chip>
                    )}
                    {!c.clerkUserId && (
                      <Chip bg="var(--chipBg)" fg="var(--ink3)">
                        Not signed in
                      </Chip>
                    )}
                    {c.deactivatedAt && (
                      <Chip bg="var(--dangerBg)" fg="var(--danger)">
                        Archived
                      </Chip>
                    )}
                  </div>
                  <p style={{ margin: "5px 0 0", font: "400 13px/1 'Inter'", color: "var(--ink2)" }}>
                    {c.contractorType.name} · <span style={{ color: "var(--ink3)" }}>{c.email}</span>
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
                <div style={{ textAlign: "right", minWidth: 82 }}>
                  <p
                    style={{
                      margin: 0,
                      font: "600 15px/1 var(--display)",
                      color: "var(--ink)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatMoney(c.walletBalanceCents)}
                  </p>
                  <p style={{ margin: "3px 0 0", font: "400 11px/1 'Inter'", color: "var(--ink3)" }}>
                    balance
                  </p>
                </div>
                <ContractorRowActions
                  contractorId={c.id}
                  deactivated={Boolean(c.deactivatedAt)}
                  signedIn={Boolean(c.clerkUserId)}
                />
              </div>
            </div>
          ))
        )}
        <PaginationControls
          variant="admin"
          page={page}
          totalPages={totalPages}
          totalCount={filteredCount}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50]}
          pathname="/admin/contractors"
          params={{ q: q || undefined, filter: filter || undefined }}
        />
      </div>
    </div>
  );
}
