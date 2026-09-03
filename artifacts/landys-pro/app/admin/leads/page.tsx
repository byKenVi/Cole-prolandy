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
import { leadCategoryIcon, leadCategoryLabel, leadScopeLabel } from "@/lib/resolved-lead";
import { leadStatusChip } from "@/lib/admin-display";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage, parsePageSize } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZES = [10, 20, 50];

type StatusTab = "all" | "new" | "active" | "accepted" | "closed";

function parseSort(raw: string | undefined): "date" | "value" {
  return raw === "value" ? "value" : "date";
}

function parseDir(raw: string | undefined): "asc" | "desc" {
  return raw === "asc" ? "asc" : "desc";
}

function parseStatus(raw: string | undefined): StatusTab {
  if (raw === "new" || raw === "active" || raw === "accepted" || raw === "closed" || raw === "all") {
    return raw;
  }
  return "all";
}

function statusWhere(tab: StatusTab): Prisma.LeadWhereInput {
  switch (tab) {
    case "new":
      return { status: "NEW" };
    case "active":
      return { status: "DISTRIBUTED" };
    case "accepted":
      return { acceptedCount: { gt: 0 }, status: { in: ["DISTRIBUTED", "SOLD_OUT"] } };
    case "closed":
      return { status: { in: ["EXPIRED", "CLOSED"] } };
    default:
      return {};
  }
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
    status?: string;
  }>;
}) {
  const sp = await searchParams;
  const initialQuery = typeof sp.q === "string" ? sp.q : "";
  const requestedPage = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize, DEFAULT_PAGE_SIZE, PAGE_SIZES);
  const sort = parseSort(sp.sort);
  const dir = parseDir(sp.dir);
  const statusTab = parseStatus(sp.status);

  await expireLeads(prisma).catch(() => undefined);

  const where: Prisma.LeadWhereInput = statusWhere(statusTab);

  const [
    totalCount,
    newCount,
    activeCount,
    acceptedCount,
    closedCount,
    pipelineAgg,
    filteredCount,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.count({ where: { status: "DISTRIBUTED" } }),
    prisma.lead.count({
      where: { acceptedCount: { gt: 0 }, status: { in: ["DISTRIBUTED", "SOLD_OUT"] } },
    }),
    prisma.lead.count({ where: { status: { in: ["EXPIRED", "CLOSED"] } } }),
    prisma.lead.aggregate({
      where: { status: { in: ["NEW", "DISTRIBUTED", "SOLD_OUT"] } },
      _sum: { budgetCents: true },
    }),
    prisma.lead.count({ where }),
  ]);

  const { page, skip, take, totalPages } = paginationMeta(filteredCount, requestedPage, pageSize);

  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sort === "value" ? { budgetCents: dir } : { createdAt: dir };

  const leads = await prisma.lead.findMany({
    where,
    orderBy,
    skip,
    take,
    select: {
      id: true,
      status: true,
      budgetCents: true,
      acceptedCount: true,
      propertyLocation: true,
      createdAt: true,
      projectType: {
        select: { name: true, contractorType: { select: { name: true, icon: true } } },
      },
      workType: { select: { name: true } },
      contractorCategory: { select: { name: true } },
      _count: { select: { matches: true } },
    },
  });

  const pipelineValue = pipelineAgg._sum.budgetCents ?? 0;

  const rows: LeadRow[] = leads.map((l) => ({
    id: l.id,
    title: leadScopeLabel(l),
    category: leadCategoryLabel(l),
    place: l.propertyLocation,
    recipients: l._count.matches,
    accepted: l.acceptedCount,
    sent: formatDate(l.createdAt),
    sentAtIso: l.createdAt.toISOString(),
    price: l.budgetCents == null ? "—" : formatMoney(l.budgetCents),
    priceCents: l.budgetCents,
    iconSrc: iconSrcFor({
      icon: leadCategoryIcon(l),
      category: leadCategoryLabel(l),
      project: leadScopeLabel(l),
    }),
    status: leadStatusChip(l.status),
    filter:
      l.status === "NEW"
        ? "new"
        : l.status === "DISTRIBUTED"
          ? "active"
          : l.acceptedCount > 0
            ? "accepted"
            : l.status === "EXPIRED" || l.status === "CLOSED"
              ? "closed"
              : "other",
  }));

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Opportunities"
        title="Leads"
        subtitle="Estimate requests from Landys.co — matching, acceptance, and status."
        action={<GoldButtonLink href="/admin/leads/new">Create opportunity</GoldButtonLink>}
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
        <StatCard label="Total requests" value={String(totalCount)} />
        <StatCard label="Active / distributed" value={String(activeCount)} valueColor="var(--sageFg)" />
        <StatCard label="With acceptances" value={String(acceptedCount)} />
        <StatCard
          label="Est. pipeline value"
          value={formatMoney(pipelineValue)}
          sub="Sum of estimated project values on open requests"
        />
      </div>

      <Suspense fallback={null}>
        <LeadsTable
          leads={rows}
          total={filteredCount}
          pageCount={leads.length}
          initialQuery={initialQuery}
          initialStatus={statusTab}
          statusCounts={{
            all: totalCount,
            new: newCount,
            active: activeCount,
            accepted: acceptedCount,
            closed: closedCount,
          }}
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
                status: statusTab !== "all" ? statusTab : undefined,
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
