import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/tier-badge";
import { LeadStatusBadge, LeadMatchStatusBadge } from "@/components/status-badge";
import { RefundButton } from "@/components/admin/refund-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteLead } from "@/app/actions/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-base text-text">{value}</dd>
    </div>
  );
}

export default async function AdminLeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      projectType: { include: { contractorType: true } },
      landType: true,
      matches: {
        orderBy: { createdAt: "asc" },
        include: { contractor: { select: { id: true, name: true } } },
      },
    },
  });
  if (!lead) notFound();

  return (
    <div className="admin-fade-up flex max-w-3xl flex-col gap-8">
      <Link
        href="/admin/leads"
        className="flex items-center gap-1 text-sm"
        style={{ color: "var(--ink2)" }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-fraunces text-3xl font-semibold" style={{ color: "var(--ink)" }}>
            {lead.projectType.name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink2)" }}>
            {lead.projectType.contractorType.name} · {lead.propertyLocation}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <TierBadge tier={lead.tier} />
            <LeadStatusBadge status={lead.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/leads/${lead.id}/edit`}>Edit</Link>
          </Button>
          <DeleteButton
            onDelete={deleteLead.bind(null, lead.id)}
            redirectTo="/admin/leads"
            label="Delete"
            confirmLabel="Delete lead"
          />
        </div>
      </header>

      <Card className="flex flex-col gap-5 p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Lead price</p>
          <p className="mt-1 text-3xl font-semibold leading-tight tabular-nums text-text">
            {formatMoney(lead.priceCents)}
          </p>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <Field label="Landowner name" value={lead.landownerName} />
          <Field label="Landowner phone" value={lead.landownerPhone} />
          <Field label="Landowner email" value={lead.landownerEmail} />
          <Field label="Property location" value={lead.propertyLocation} />
          <Field label="Project type" value={lead.projectType.name} />
          <Field label="Land type" value={lead.landType?.name ?? "—"} />
          <Field label="Source" value={lead.source} />
          <Field label="Created" value={formatDate(lead.createdAt)} />
          <Field label="Expires" value={formatDate(lead.expiresAt)} />
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-xl font-semibold text-text">
          Distributed to {lead.matches.length} contractor(s)
        </h2>
        {lead.matches.length === 0 ? (
          <p className="text-sm text-text-muted">No recipients.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {lead.matches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link
                  href={`/admin/contractors/${m.contractor.id}`}
                  className="text-sm font-medium text-text hover:underline"
                >
                  {m.contractor.name}
                </Link>
                <span className="flex items-center gap-3">
                  <LeadMatchStatusBadge status={m.status} />
                  {m.status === "ACCEPTED" && <RefundButton leadMatchId={m.id} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
