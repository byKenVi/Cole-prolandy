import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { PageHeader, GoldButtonLink, StatCard } from "@/components/admin/ui";
import { LeadsTable, type LeadRow } from "@/components/admin/leads-table";
import { PaginationControls } from "@/components/pagination-controls";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { iconSrcFor } from "@/lib/project-icons";
import { leadStatusChip, tierChip } from "@/lib/admin-display";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage, parsePageSize } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZES = [10, 20, 50];

function parseSort(raw: string | undefined): "date" | "value" {
  return raw === "value" ? "value" : "date";
}

function parseDir(raw: string | undefined): "asc" | "desc" {
  return raw === "asc" ? "asc" : "desc";
}

function parseTier(raw: string | undefined): number | null {
  if (raw === "1" || raw === "2" || raw === "3") return Number(raw);
  return null;
}

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    dir?: string;
    tier?: string;
  }>;
}) {
  const sp = await searchParams;
  const initialQuery = typeof sp.q === "string" ? sp.q : "";
  const requestedPage = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize, DEFAULT_PAGE_SIZE, PAGE_SIZES);
  const sort = parseSort(sp.sort);
  const dir = parseDir(sp.dir);
  const tier = parseTier(sp.tier);

  await expireLeads(prisma).catch(() => undefined);

  const where: Prisma.LeadWhereInput = {};
  if (tier != null) where.tier = tier;

  const [totalCount, distributed, expired, listedAgg, filteredCount] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "DISTRIBUTED" } }),
    prisma.lead.count({ where: { status: "EXPIRED" } }),
    prisma.lead.aggregate({ _sum: { priceCents: true } }),
    prisma.lead.count({ where }),
  ]);

  const { page, skip, take, totalPages } = paginationMeta(filteredCount, requestedPage, pageSize);

  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sort === "value" ? { priceCents: dir } : { createdAt: dir };

  const leads = await prisma.lead.findMany({
    where,
    orderBy,
    skip,
    take,
    select: {
      id: true,
      tier: true,
      status: true,
      priceCents: true,
      propertyLocation: true,
      createdAt: true,
      projectType: {
        select: { name: true, contractorType: { select: { name: true, icon: true } } },
      },
      _count: { select: { matches: true } },
    },
  });

  const listedValue = listedAgg._sum.priceCents ?? 0;

  const rows: LeadRow[] = leads.map((l) => ({
    id: l.id,
    title: l.projectType.name,
    category: l.projectType.contractorType.name,
    place: l.propertyLocation,
    recipients: l._count.matches,
    sent: formatDate(l.createdAt),
    sentAtIso: l.createdAt.toISOString(),
    price: formatMoney(l.priceCents),
    priceCents: l.priceCents,
    iconSrc: iconSrcFor({
      icon: l.projectType.contractorType.icon,
      category: l.projectType.contractorType.name,
      project: l.projectType.name,
    }),
    tier: tierChip(l.tier),
    tierNum: l.tier,
    status: leadStatusChip(l.status),
    filter:
      l.status === "DISTRIBUTED" ? "distributed" : l.status === "EXPIRED" ? "expired" : "other",
  }));

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Distribution"
        title="Leads"
        subtitle="Every job distributed to your contractors — newest first. Prices are snapshotted at send."
        action={<GoldButtonLink href="/admin/leads/new">New lead</GoldButtonLink>}
      />

      <div
        className="admin-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total leads" value={String(totalCount)} />
        <StatCard label="Distributed" value={String(distributed)} valueColor="var(--sageFg)" />
        <StatCard label="Expired" value={String(expired)} valueColor="var(--danger)" />
        <StatCard label="Listed value" value={formatMoney(listedValue)} />
      </div>

      <Suspense fallback={null}>
        <LeadsTable
          leads={rows}
          total={filteredCount}
          pageCount={leads.length}
          initialQuery={initialQuery}
          initialTier={tier != null ? String(tier) : ""}
          initialSort={sort}
          initialDir={dir}
          pagination={
            <PaginationControls
              variant="admin"
              page={page}
              totalPages={totalPages}
              totalCount={filteredCount}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              pathname="/admin/leads"
              params={{
                q: initialQuery || undefined,
                tier: tier != null ? String(tier) : undefined,
                sort: sort !== "date" ? sort : undefined,
                dir: dir !== "desc" ? dir : undefined,
              }}
            />
          }
        />
      </Suspense>
    </div>
  );
}
