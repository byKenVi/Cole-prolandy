import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { PageHeader, GoldButtonLink, StatCard } from "@/components/admin/ui";
import { LeadsTable, type LeadRow } from "@/components/admin/leads-table";
import { PaginationControls } from "@/components/pagination-controls";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { iconSrcFor } from "@/lib/project-icons";
import { leadStatusChip, tierChip } from "@/lib/admin-display";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const initialQuery = typeof sp.q === "string" ? sp.q : "";
  const requestedPage = parsePage(sp.page);

  await expireLeads(prisma).catch(() => undefined);

  const [totalCount, distributed, expired, listedAgg] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "DISTRIBUTED" } }),
    prisma.lead.count({ where: { status: "EXPIRED" } }),
    prisma.lead.aggregate({ _sum: { priceCents: true } }),
  ]);

  const { page, skip, take, totalPages } = paginationMeta(
    totalCount,
    requestedPage,
    DEFAULT_PAGE_SIZE,
  );

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
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
    price: formatMoney(l.priceCents),
    iconSrc: iconSrcFor({
      icon: l.projectType.contractorType.icon,
      category: l.projectType.contractorType.name,
      project: l.projectType.name,
    }),
    tier: tierChip(l.tier),
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

      <LeadsTable
        leads={rows}
        total={totalCount}
        pageCount={leads.length}
        initialQuery={initialQuery}
        pagination={
          <PaginationControls
            variant="admin"
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pathname="/admin/leads"
            params={{ q: initialQuery || undefined }}
          />
        }
      />
    </div>
  );
}
