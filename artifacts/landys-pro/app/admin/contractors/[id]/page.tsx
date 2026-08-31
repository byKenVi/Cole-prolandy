import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ViewAsButton } from "@/components/admin/view-as-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { RowLink } from "@/components/admin/row-link";
import { PaginationControls } from "@/components/pagination-controls";
import { deactivateContractor, reactivateContractor, resetContractorClerkLink } from "@/app/actions/admin";
import { LeadMatchStatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { formatCardLabel } from "@/lib/card-display";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";
import { leadScopeLabel } from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

function estimateLabel(lead: { budgetCents: number | null; priceCents: number | null }) {
  const cents = lead.budgetCents ?? lead.priceCents;
  return cents == null ? "Pending review" : formatMoney(cents);
}

export default async function ContractorDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ matchesPage?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const contractor = await prisma.contractor.findUnique({
    where: { id },
    include: {
      contractorCategory: { select: { name: true } },
      projects: {
        include: { contractorType: { select: { id: true, name: true } } },
        orderBy: { contractorType: { name: "asc" } },
      },
    },
  });
  if (!contractor) notFound();

  const assignedProjects = contractor.projects.map((p) => p.contractorType);
  const matchesWhere = { contractorId: id };

  const matchCount = await prisma.leadMatch.count({ where: matchesWhere });
  const matchesMeta = paginationMeta(matchCount, parsePage(sp.matchesPage), DEFAULT_PAGE_SIZE);

  const leadMatches = await prisma.leadMatch.findMany({
    where: matchesWhere,
    orderBy: { createdAt: "desc" },
    skip: matchesMeta.skip,
    take: matchesMeta.take,
    include: {
      lead: { include: { projectType: true } },
      successFee: { select: { status: true } },
    },
  });

  const hasSavedCard = Boolean(contractor.stripeDefaultPaymentMethodId);
  const cardLabel = formatCardLabel(contractor.cardBrand, contractor.cardLast4);

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
            {contractor.contractorCategory?.name ?? "No contractor category"} ·{" "}
            {assignedProjects.map((p) => p.name).join(" · ")} · {contractor.email} ·{" "}
            {contractor.phone}
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
              confirmLabel="Reset link"
              title="Reset this contractor's Clerk link?"
              description={`${contractor.name} will need to claim their account again from a fresh invitation email.`}
              successMessage="Clerk link reset."
              showTrashIcon={false}
              destructive={false}
            />
          )}
          {contractor.deactivatedAt ? (
            <DeleteButton
              onDelete={reactivateContractor.bind(null, contractor.id)}
              label="Reactivate"
              confirmLabel="Reactivate"
              title="Reactivate this contractor?"
              description={`${contractor.name} will regain access to the portal and start receiving opportunities again.`}
              successMessage="Contractor reactivated."
              showTrashIcon={false}
              destructive={false}
            />
          ) : (
            <DeleteButton
              onDelete={deactivateContractor.bind(null, contractor.id)}
              redirectTo="/admin/contractors"
              label="Deactivate"
              confirmLabel="Deactivate"
              title="Deactivate this contractor?"
              description={`${contractor.name} will lose portal access and stop receiving new opportunities. You can reactivate them later.`}
              successMessage="Contractor deactivated."
            />
          )}
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Profile</h2>
        {contractor.aboutSection && (
          <p className="text-sm text-text-muted">{contractor.aboutSection}</p>
        )}
        {assignedProjects.length > 0 && (
          <p className="text-sm text-text-muted">
            Projects: {assignedProjects.map((p) => p.name).join(", ")}
          </p>
        )}
        <p className="text-sm text-text-muted">
          Saved card:{" "}
          {hasSavedCard ? (
            <span className="font-medium text-success">{cardLabel ?? "On file"}</span>
          ) : (
            <span className="font-medium text-text-muted">None on file</span>
          )}
          {" · "}
          Used for success-fee payments when due.
        </p>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Opportunities &amp; jobs
        </h2>
        {matchCount === 0 ? (
          <p className="text-sm text-text-muted">No matches yet.</p>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {leadMatches.map((m) => (
              <div
                key={m.id}
                className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-primary-soft"
              >
                <RowLink href={`/admin/leads/${m.leadId}`} label={`Open ${leadScopeLabel(m.lead)}`} />
                <div className="min-w-0">
                  <p className="font-medium text-text">{leadScopeLabel(m.lead)}</p>
                  <p className="text-xs text-text-muted">{m.lead.propertyLocation}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tabular-nums text-sm text-text-muted">
                    {estimateLabel(m.lead)}
                  </span>
                  {m.jobOutcome !== "OPEN" && (
                    <Badge variant={m.jobOutcome === "WON" ? "default" : "neutral"}>
                      {m.jobOutcome === "WON" ? "Won" : "Lost"}
                    </Badge>
                  )}
                  {m.successFee && (
                    <Badge variant="neutral">{m.successFee.status.replace(/_/g, " ")}</Badge>
                  )}
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
            />
          </Card>
        )}
      </section>
    </div>
  );
}
