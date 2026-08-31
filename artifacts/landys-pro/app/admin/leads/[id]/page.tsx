import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Circle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge, LeadMatchStatusBadge } from "@/components/status-badge";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteLead } from "@/app/actions/admin";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { leadCategoryLabel, leadDisplayInclude, leadScopeLabel } from "@/lib/resolved-lead";
import { LeadReviewForm } from "@/components/admin/lead-review-form";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-base text-text">{value}</dd>
    </div>
  );
}

type MatchWithContractor = {
  id: string;
  status: string;
  createdAt: Date;
  acceptedAt: Date | null;
  contractor: { id: string; name: string; email: string };
};

type TimelineEvent = {
  key: string;
  icon: "offered" | "accepted" | "declined" | "expired" | "pending";
  label: string;
  detail: string;
  time: Date | null;
};

function buildEvents(m: MatchWithContractor): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      key: `${m.id}-offered`,
      icon: "offered",
      label: "Offered",
      detail: m.contractor.name,
      time: m.createdAt,
    },
  ];

  if (m.status === "ACCEPTED" && m.acceptedAt) {
    events.push({
      key: `${m.id}-accepted`,
      icon: "accepted",
      label: "Accepted",
      detail: `by ${m.contractor.name}`,
      time: m.acceptedAt,
    });
  } else if (m.status === "DECLINED") {
    events.push({
      key: `${m.id}-declined`,
      icon: "declined",
      label: "Declined",
      detail: `by ${m.contractor.name}`,
      time: null,
    });
  } else if (m.status === "EXPIRED") {
    events.push({
      key: `${m.id}-expired`,
      icon: "expired",
      label: "Expired",
      detail: "lead window closed",
      time: null,
    });
  } else {
    events.push({
      key: `${m.id}-pending`,
      icon: "pending",
      label: "Awaiting response",
      detail: `from ${m.contractor.name}`,
      time: null,
    });
  }

  return events;
}

function TimelineEventRow({ event, last }: { event: TimelineEvent; last: boolean }) {
  const iconEl = (() => {
    if (event.icon === "accepted")
      return <CheckCircle2 className="h-4 w-4 text-[#2F6B4A]" strokeWidth={2} />;
    if (event.icon === "declined")
      return <XCircle className="h-4 w-4 text-[#C0392B]" strokeWidth={2} />;
    if (event.icon === "expired")
      return <Clock className="h-4 w-4 text-[#9A3B2E]" strokeWidth={2} />;
    if (event.icon === "pending")
      return <Circle className="h-4 w-4 text-text-muted" strokeWidth={2} />;
    // offered
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#C0803C] bg-[#FBF3E6]" />
    );
  })();

  return (
    <div className="flex gap-3">
      {/* Dot + vertical line */}
      <div className="flex flex-col items-center">
        <div className="flex h-5 w-5 flex-none items-center justify-center">{iconEl}</div>
        {!last && <div className="mt-1 w-px flex-1 bg-border" style={{ minHeight: 20 }} />}
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-5"}`}>
        <p className="text-sm font-semibold text-text">{event.label}</p>
        <p className="text-xs text-text-muted">{event.detail}</p>
        {event.time && (
          <p className="mt-0.5 text-xs text-text-muted">{formatDate(event.time)}</p>
        )}
      </div>
    </div>
  );
}

export default async function AdminLeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      ...leadDisplayInclude,
      matches: {
        orderBy: { createdAt: "asc" },
        include: {
          contractor: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
    },
  });
  if (!lead) notFound();

  return (
    <div className="admin-fade-up flex w-full flex-col gap-8">
      <Link
        href="/admin/leads"
        className="flex items-center gap-1 text-sm"
        style={{ color: "var(--ink2)" }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            style={{
              margin: "0 0 8px",
              font: "600 11px/1 var(--mono)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink3)",
            }}
          >
            Client
          </p>
          <h1 className="font-fraunces text-3xl font-semibold" style={{ color: "var(--ink)" }}>
            {lead.landownerName ?? "Name not provided"}
          </h1>
          <p className="mt-1 text-base font-medium" style={{ color: "var(--ink)" }}>
            {leadScopeLabel(lead)}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink2)" }}>
            {leadCategoryLabel(lead)} · {lead.propertyLocation}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            {lead.acceptedCount > 0 && (
              <span
                className="rounded-full px-2 py-1 text-xs font-semibold"
                style={{ background: "var(--goldSoft)", color: "var(--goldSoftFg)" }}
              >
                {lead.acceptedCount} accepted
              </span>
            )}
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
            title="Delete this lead?"
            description={`“${leadScopeLabel(lead)}” for ${lead.landownerName ?? lead.landownerEmail} will be removed permanently. This cannot be undone.`}
            successMessage="Lead deleted."
          />
        </div>
      </header>

      {lead.reviewStatus !== "ROUTED" && (lead.budgetReviewRequired || lead.tierReviewRequired) && (
        <LeadReviewForm
          leadId={lead.id}
          currentBudgetCents={lead.budgetCents}
          budgetRaw={lead.budget}
          contractorReviewRequired={lead.contractorReviewRequired}
        />
      )}

      <Card className="flex flex-col gap-5 p-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Est. project value</p>
          <p className="mt-1 text-3xl font-semibold leading-tight tabular-nums text-text">
            {lead.budgetCents != null
              ? formatMoney(lead.budgetCents)
              : "Pending review"}
          </p>
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          <Field label="Landowner name" value={lead.landownerName ?? "Not provided"} />
          <Field label="Landowner phone" value={lead.landownerPhone ?? "Not provided"} />
          <Field label="Landowner email" value={lead.landownerEmail} />
          <Field label="Property location" value={lead.propertyLocation} />
          <Field label="Project details" value={lead.description ?? "—"} />
          <Field label="Category" value={lead.contractorCategory?.name ?? leadCategoryLabel(lead)} />
          <Field label="Work / project type" value={leadScopeLabel(lead)} />
          <Field label="Land type" value={lead.landType?.name ?? "—"} />
          <Field label="Budget band" value={lead.budgetBand ?? "—"} />
          <Field label="Budget" value={lead.budget ?? "—"} />
          <Field
            label="Normalized budget"
            value={lead.budgetCents != null ? formatMoney(lead.budgetCents) : "—"}
          />
          <Field label="Resolved tier" value={lead.tier != null ? `Tier ${lead.tier}` : "—"} />
          <Field
            label="Acceptances"
            value={`${lead.acceptedCount} / ${lead.maxPurchases}${lead.soldOutAt ? " (sold out)" : ""}`}
          />
          <Field label="Review blocker" value={lead.reviewBlocker ?? "—"} />
          <Field label="Urgency" value={lead.urgencyCode ?? lead.urgency ?? "—"} />
          <Field label="Timeline" value={lead.timelineCode ?? (lead.timeline ? formatDate(lead.timeline) : "—")} />
          <Field label="Source" value={lead.source} />
          <Field label="Created" value={formatDate(lead.createdAt)} />
          <Field label="Expires" value={lead.expiresAt ? formatDate(lead.expiresAt) : "Not started"} />
        </dl>
      </Card>

      {/* Distributed contractors */}
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
                <div className="min-w-0">
                  <Link
                    href={`/admin/contractors/${m.contractor.id}`}
                    className="text-sm font-semibold text-text hover:underline"
                  >
                    {m.contractor.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-text-muted">{m.contractor.email}</p>
                </div>
                <span className="flex items-center gap-3">
                  <LeadMatchStatusBadge status={m.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Assignment history timeline */}
      <Card className="flex flex-col gap-6 p-6">
        <h2 className="font-display text-xl font-semibold text-text">Assignment history</h2>
        {lead.matches.length === 0 ? (
          <p className="text-sm text-text-muted">Not yet distributed.</p>
        ) : (
          <ol className="flex flex-col gap-8">
            {lead.matches.map((m) => {
              const events = buildEvents(m);
              return (
                <li key={m.id}>
                  <div className="mb-3 flex items-center gap-2">
                    <Link
                      href={`/admin/contractors/${m.contractor.id}`}
                      className="text-sm font-semibold text-text hover:underline"
                    >
                      {m.contractor.name}
                    </Link>
                    <span className="text-sm text-text-muted">·</span>
                    <span className="text-sm text-text-muted">{m.contractor.email}</span>
                    <LeadMatchStatusBadge status={m.status} />
                  </div>
                  <div className="ml-1 flex flex-col">
                    {events.map((event, i) => (
                      <TimelineEventRow
                        key={event.key}
                        event={event}
                        last={i === events.length - 1}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
