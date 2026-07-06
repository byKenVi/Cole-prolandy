import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WalletBalance } from "@/components/wallet-balance";
import { WalletAdjustForm } from "@/components/admin/wallet-adjust-form";
import { ViewAsButton } from "@/components/admin/view-as-button";
import { LeadMatchStatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Top-up",
  LEAD_CHARGE: "Lead charge",
  REFUND: "Refund",
  ADMIN_ADJUST: "Adjustment",
};

export default async function ContractorDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contractor = await prisma.contractor.findUnique({
    where: { id },
    include: {
      contractorType: true,
      services: { include: { service: true } },
      walletTransactions: { orderBy: { createdAt: "desc" }, take: 30 },
      leadMatches: {
        orderBy: { createdAt: "desc" },
        include: { lead: { include: { projectType: true } } },
      },
    },
  });
  if (!contractor) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/contractors" className="flex items-center gap-1 text-sm text-text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to contractors
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-text">{contractor.name}</h1>
            {contractor.isTopPro ? (
              <Badge variant="success">Top Pro</Badge>
            ) : contractor.isPro ? (
              <Badge>Pro</Badge>
            ) : (
              <Badge variant="neutral">Free</Badge>
            )}
            {!contractor.clerkUserId && <Badge variant="neutral">Not signed in</Badge>}
          </div>
          <p className="text-sm text-text-muted">
            {contractor.contractorType.name} · {contractor.email} · {contractor.phone}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/contractors/${contractor.id}/edit`}>Edit</Link>
          </Button>
          <ViewAsButton contractorId={contractor.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">Wallet balance</p>
          <WalletBalance cents={contractor.walletBalanceCents} />
          {contractor.aboutSection && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-text-muted">
              {contractor.aboutSection}
            </p>
          )}
          {contractor.services.length > 0 && (
            <p className="text-sm text-text-muted">
              Services: {contractor.services.map((s) => s.service.name).join(", ")}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wallet management</CardTitle>
          </CardHeader>
          <WalletAdjustForm contractorId={contractor.id} />
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Leads</h2>
        {contractor.leadMatches.length === 0 ? (
          <p className="text-sm text-text-muted">No leads yet.</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {contractor.leadMatches.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-text">{m.lead.projectType.name}</p>
                  <p className="text-xs text-text-muted">{m.lead.propertyLocation}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-sm text-text-muted">
                    {formatMoney(m.lead.priceCents)}
                  </span>
                  <LeadMatchStatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text">Transactions</h2>
        {contractor.walletTransactions.length === 0 ? (
          <p className="text-sm text-text-muted">No transactions.</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {contractor.walletTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-text">{TYPE_LABEL[t.type] ?? t.type}</p>
                  <p className="text-xs text-text-muted">
                    {formatDate(t.createdAt)}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "tabular-nums font-semibold",
                    t.amountCents >= 0 ? "text-success" : "text-text",
                  )}
                >
                  {t.amountCents >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(t.amountCents))}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
