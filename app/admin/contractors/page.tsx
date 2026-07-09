import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader, GoldButtonLink, StatCard, Chip } from "@/components/admin/ui";
import { ContractorFilters } from "@/components/admin/contractor-filters";
import { ContractorRowActions } from "@/components/admin/contractor-row-actions";
import { RowLink } from "@/components/admin/row-link";
import { formatMoney } from "@/lib/money";

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
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;

  const where: Prisma.ContractorWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter === "pro") where.isPro = true;
  if (filter === "free") where.isPro = false;
  if (filter === "toppro") where.isTopPro = true;

  const [contractors, totalCount, proCount, walletAgg] = await Promise.all([
    prisma.contractor.findMany({
      where,
      orderBy: { name: "asc" },
      include: { contractorType: { select: { name: true } } },
    }),
    prisma.contractor.count(),
    prisma.contractor.count({ where: { isPro: true } }),
    prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
  ]);

  return (
    <div className="admin-fade-up">
      <PageHeader
        title="Contractors"
        subtitle="The pros who receive and accept your leads."
        action={<GoldButtonLink href="/admin/contractors/new">New contractor</GoldButtonLink>}
      />

      <div
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
              }}
            >
              <RowLink href={`/admin/contractors/${c.id}`} label={`Open ${c.name}`} />
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
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
                    {c.isTopPro ? (
                      <Chip bg="var(--goldSoft)" fg="var(--goldSoftFg)">
                        TOP PRO
                      </Chip>
                    ) : c.isPro ? (
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
                      font: "600 15px/1 'Inter'",
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
                <ContractorRowActions contractorId={c.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
