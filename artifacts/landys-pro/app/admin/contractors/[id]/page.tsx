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
import { PaginationControls } from "@/components/pagination-controls";
import { deactivateContractor, reactivateContractor, resetContractorClerkLink } from "@/app/actions/admin";
import { LeadMatchStatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { formatCardLabel } from "@/lib/card-display";
import { cn } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ matchesPage?: string; txPage?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const contractor = await prisma.contractor.findUnique({
    where: { id },
    include: {
      projects: {
        include: { contractorType: { select: { id: true, name: true } } },
        orderBy: { contractorType: { name: "asc" } },
      },
    },
  });
  if (!contractor) notFound();

  const assignedProjects = contractor.projects.map((p) => p.contractorType);
  const matchesWhere = { contractorId: id };
  const txWhere = { contractorId: id };

  const [matchCount, txCount, topupAgg, acceptedMatches, minimumLeadPrice] = await Promise.all([
    prisma.leadMatch.count({ where: matchesWhere }),
    prisma.walletTransaction.count({ where: txWhere }),
    prisma.walletTransaction.aggregate({
      _sum: { amountCents: true },
      where: { contractorId: id, type: "TOPUP" },
    }),
    prisma.leadMatch.findMany({
      where: { contractorId: id, status: "ACCEPTED" },
      orderBy: { acceptedAt: "desc" },
      include: {
        lead: { include: { projectType: true } },
        walletTransactions: { select: { type: true } },
      },
    }),
    prisma.priceTier.aggregate({
      _min: { priceCents: true },
      where: { contractorTypeId: { in: assignedProjects.map((project) => project.id) } },
    }),
  ]);

  const matchesMeta = paginationMeta(matchCount, parsePage(sp.matchesPage), DEFAULT_PAGE_SIZE);
  const txMeta = paginationMeta(txCount, parsePage(sp.txPage), DEFAULT_PAGE_SIZE);

  const [leadMatches, walletTransactions] = await Promise.all([
    prisma.leadMatch.findMany({
      where: matchesWhere,
      orderBy: { createdAt: "desc" },
      skip: matchesMeta.skip,
      take: matchesMeta.take,
      include: {
        lead: { include: { projectType: true } },
      },
    }),
    prisma.walletTransaction.findMany({
      where: txWhere,
      orderBy: { createdAt: "desc" },
      skip: txMeta.skip,
      take: txMeta.take,
    }),
  ]);

  const topupTotalCents = topupAgg._sum.amountCents ?? 0;
  const hasSavedCard = Boolean(contractor.stripeDefaultPaymentMethodId);
  const cardLabel = formatCardLabel(contractor.cardBrand, contractor.cardLast4);

  const acceptedLeads = acceptedMatches.map((m) => ({
    matchId: m.id,
    projectName: m.lead.projectType.name,
    location: m.lead.propertyLocation,
    priceCents: m.lead.priceCents,
    alreadyRefunded: m.walletTransactions.some((t) => t.type === "REFUND"),
  }));

  const listParams = {
    matchesPage: matchesMeta.page > 1 ? matchesMeta.page : undefined,
    txPage: txMeta.page > 1 ? txMeta.page : undefined,
  };

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
            {contractor.isPro ? (
              <Badge>Pro</Badge>
            ) : (
              <Badge variant="neutral">Free</Badge>
            )}
            {!contractor.clerkUserId && <Badge variant="neutral">Not signed in</Badge>}
            {contractor.deactivatedAt && <Badge variant="danger">Deactivated</Badge>}
          </div>
          <p className="text-sm" style={{ color: "var(--ink2)" }}>
            {assignedProjects.map((p) => p.name).join(" · ")} · {contractor.email} · {contractor.phone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/contractors/${contractor.id}/edit`}>Edit</Link>
          </Button>
          {!contractor.deactivatedAt && <ViewAsButton contractorId={contractor.id} />}
          {contractor.clerkUserId && (
            <DeleteButton
              onDelete={resetContractorClerkLink.bind(null, contractor.id)}
              label="Reset Clerk link"
              confirmLabel="Confirm reset"
              showTrashIcon={false}
            />
          )}
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
          <WalletBalance
            cents={contractor.walletBalanceCents}
            lowThresholdCents={minimumLeadPrice._min.priceCents ?? 0}
            label="Wallet balance"
          />
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
          {assignedProjects.length > 0 && (
            <p className="text-sm text-text-muted">
              Projects: {assignedProjects.map((p) => p.name).join(", ")}
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
        {matchCount === 0 ? (
          <p className="text-sm text-text-muted">No leads yet.</p>
        ) : (
          <Card className="divide-y divide-border p-0 overflow-hidden">
            {leadMatches.map((m) => (
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
            <PaginationControls
              variant="admin"
              page={matchesMeta.page}
              totalPages={matchesMeta.totalPages}
              totalCount={matchCount}
              pageSize={DEFAULT_PAGE_SIZE}
              pathname={`/admin/contractors/${id}`}
              pageParam="matchesPage"
              params={{ txPage: listParams.txPage }}
            />
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Transactions
        </h2>
        {txCount === 0 ? (
          <p className="text-sm text-text-muted">No transactions.</p>
        ) : (
          <Card className="divide-y divide-border p-0 overflow-hidden">
            {walletTransactions.map((t) => (
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
            <PaginationControls
              variant="admin"
              page={txMeta.page}
              totalPages={txMeta.totalPages}
              totalCount={txCount}
              pageSize={DEFAULT_PAGE_SIZE}
              pathname={`/admin/contractors/${id}`}
              pageParam="txPage"
              params={{ matchesPage: listParams.matchesPage }}
            />
          </Card>
        )}
      </section>
    </div>
  );
}
