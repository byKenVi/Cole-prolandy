import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/tier-badge";
import { LeadStatusBadge } from "@/components/status-badge";
import { RowLink } from "@/components/admin/row-link";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminLeads() {
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
      projectType: { select: { name: true, contractorType: { select: { name: true } } } },
      _count: { select: { matches: true } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-text">Leads</h1>
        <Button asChild variant="accent">
          <Link href="/admin/leads/new">New lead</Link>
        </Button>
      </div>

      {leads.length === 0 ? (
        <EmptyState title="No leads yet" description="Create one manually or via the estimate form." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-primary-soft"
            >
              <RowLink href={`/admin/leads/${lead.id}`} label={`Open ${lead.projectType.name} lead`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-text">{lead.projectType.name}</p>
                  <TierBadge tier={lead.tier} />
                  <LeadStatusBadge status={lead.status} />
                </div>
                <p className="truncate text-sm text-text-muted">
                  {lead.projectType.contractorType.name} · {lead.propertyLocation}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {formatDate(lead.createdAt)} · {lead._count.matches} recipient(s)
                </p>
              </div>
              <span className="tabular-nums text-lg font-semibold text-text">
                {formatMoney(lead.priceCents)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
