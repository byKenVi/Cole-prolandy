import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { PageHeader, GoldButtonLink, StatCard } from "@/components/admin/ui";
import { LeadsTable, type LeadRow } from "@/components/admin/leads-table";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { iconSrcFor } from "@/lib/project-icons";
import { leadStatusChip, tierChip } from "@/lib/admin-display";

export const dynamic = "force-dynamic";

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q : "";

  await expireLeads(prisma).catch(() => undefined);

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
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

  const distributed = leads.filter((l) => l.status === "DISTRIBUTED").length;
  const expired = leads.filter((l) => l.status === "EXPIRED").length;
  const listedValue = leads.reduce((s, l) => s + l.priceCents, 0);

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
        title="Leads"
        subtitle="Every job distributed to your contractors — newest first."
        action={<GoldButtonLink href="/admin/leads/new">New lead</GoldButtonLink>}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total leads" value={String(leads.length)} />
        <StatCard label="Distributed" value={String(distributed)} valueColor="var(--sageFg)" />
        <StatCard label="Expired" value={String(expired)} valueColor="var(--danger)" />
        <StatCard label="Listed value" value={formatMoney(listedValue)} />
      </div>

      <LeadsTable leads={rows} total={leads.length} initialQuery={initialQuery} />
    </div>
  );
}
