import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WalletBalance } from "@/components/wallet-balance";
import { WalletRechargeForm } from "@/components/admin/wallet-adjust-form";
import { LeadRestitutionList } from "@/components/admin/lead-restitution-list";
import { ViewAsButton } from "@/components/admin/view-as-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { RowLink } from "@/components/admin/row-link";
import { deactivateContractor, reactivateContractor } from "@/app/actions/admin";
import { LeadMatchStatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { formatCardLabel } from "@/lib/card-display";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Top-up (card)",
  LEAD_CHARGE: "Lead charge",
  REFUND: "Lead restored to wallet",
  ADMIN_ADJUST: "Admin correction",
  PROMO_CREDIT: "Promo credit",
  CARD_REFUND: "Refund to card",
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
        include: {
          lead: { include: { projectType: true } },
          walletTransactions: { select: { type: true } },
        },
      },
    },
  });
  if (!contractor) notFound();

  const topupAgg = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { contractorId: id, type: "TOPUP" },
  });
  const topupTotalCents = topupAgg._sum.amountCents ?? 0;
  const hasSavedCard = Boolean(contractor.stripeDefaultPaymentMethodId);
  const cardLabel = formatCardLabel(contractor.cardBrand, contractor.cardLast4);

  const acceptedLeads = contractor.leadMatches
    .filter((m) => m.status === "ACCEPTED")
    .map((m) => ({
      matchId: m.id,
      projectName: m.lead.projectType.name,
      location: m.lead.propertyLocation,
      priceCents: m.lead.priceCents,
      alreadyRefunded: m.walletTransactions.some((t) => t.type === "REFUND"),
    }));

  return (
    <div className="admin-fade-up flex flex-col gap-6">
      <Link
        href="/admin/contractors"
        className="flex items-center gap-1 text-sm"
        style={{ color: "var(--ink2)" }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to contractors
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
              {contractor.name}
            </h1>
            {contractor.isTopPro ? (
              <Badge variant="success">Top Pro</Badge>
            ) : contractor.isPro ? (
              <Badge>Pro</Badge>
            ) : (
              <Badge variant="neutral">Free</Badge>
            )}
            {!contractor.clerkUserId && <Badge variant="neutral">Not signed in</Badge>}
            {contractor.deactivatedAt && <Badge variant="danger">Deactivated</Badge>}
          </div>
          <p className="text-sm" style={{ color: "var(--ink2)" }}>
            {contractor.contractorType.name} · {contractor.email} · {contractor.phone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/contractors/${contractor.id}/edit`}>Edit</Link>
          </Button>
          {!contractor.deactivatedAt && <ViewAsButton contractorId={contractor.id} />}
          {contractor.deactivatedAt ? (
            <DeleteButton
              onDelete={reactivateContractor.bind(null, contractor.id)}
              label="Reactivate"
              confirmLabel="Confirm reactivate"
              showTrashIcon={false}
            />
          ) : (
            <DeleteButton
              onDelete={deactivateContractor.bind(null, contractor.id)}
              redirectTo="/admin/contractors"
              label="Deactivate"
              confirmLabel="Confirm deactivate"
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <WalletBalance cents={contractor.walletBalanceCents} label="Wallet balance" />
          <div className="mt-1 flex flex-col gap-1 text-xs text-text-muted">
            <span>Lifetime card top-ups: {formatMoney(topupTotalCents)}</span>
            <span>
              Saved card:{" "}
              {hasSavedCard ? (
                <span className="font-medium text-success">{cardLabel ?? "On file"}</span>
              ) : (
                <span className="font-medium text-warning">Not saved yet</span>
              )}
            </span>
          </div>
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
            <CardTitle>Recharge wallet (saved card)</CardTitle>
          </CardHeader>
          <WalletRechargeForm contractorId={contractor.id} hasSavedCard={hasSavedCard} />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Restore lead charge to wallet</CardTitle>
          </CardHeader>
          <LeadRestitutionList leads={acceptedLeads} />
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Leads
        </h2>
        {contractor.leadMatches.length === 0 ? (
          <p className="text-sm text-text-muted">No leads yet.</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {contractor.leadMatches.map((m) => (
              <div
                key={m.id}
                className="relative flex items-center justify-between px-5 py-3 transition-colors hover:bg-primary-soft"
              >
                <RowLink href={`/admin/leads/${m.leadId}`} label={`Open ${m.lead.projectType.name} lead`} />
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
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Transactions
        </h2>
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
