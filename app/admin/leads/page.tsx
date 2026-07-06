import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/tier-badge";
import { LeadStatusBadge, LeadMatchStatusBadge } from "@/components/status-badge";
import { RefundButton } from "@/components/admin/refund-button";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminLeads() {
  await expireLeads(prisma).catch(() => undefined);

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      projectType: { include: { contractorType: true } },
      matches: { include: { contractor: { select: { name: true } } } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Leads</h1>
        <Button asChild variant="accent">
          <Link href="/admin/leads/new">New lead</Link>
        </Button>
      </div>

      {leads.length === 0 ? (
        <EmptyState title="No leads yet" description="Create one manually or via the estimate form." />
      ) : (
        <div className="flex flex-col gap-4">
          {leads.map((lead) => (
            <Card key={lead.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-text">{lead.projectType.name}</p>
                  <p className="text-sm text-text-muted">
                    {lead.projectType.contractorType.name} · {lead.propertyLocation}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Created {formatDate(lead.createdAt)} · Expires {formatDate(lead.expiresAt)} · Source: {lead.source}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <TierBadge tier={lead.tier} />
                    <LeadStatusBadge status={lead.status} />
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-text">
                    {formatMoney(lead.priceCents)}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-sm font-medium text-text-muted">
                  Distributed to {lead.matches.length} contractor(s)
                </p>
                {lead.matches.length === 0 ? (
                  <p className="text-sm text-text-muted">No recipients.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {lead.matches.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text">{m.contractor.name}</span>
                        <span className="flex items-center gap-3">
                          <LeadMatchStatusBadge status={m.status} />
                          {m.status === "ACCEPTED" && <RefundButton leadMatchId={m.id} />}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs text-text-muted">
                  Landowner (revealed to accepted contractors): {lead.landownerName} · {lead.landownerPhone}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
