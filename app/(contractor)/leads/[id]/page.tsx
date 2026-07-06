import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Mail, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/tier-badge";
import { LeadMatchStatusBadge } from "@/components/status-badge";
import { WalletBalance } from "@/components/wallet-balance";
import { LeadActions } from "@/components/lead-actions";
import { formatMoney } from "@/lib/money";
import { timeUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const match = await prisma.leadMatch.findUnique({
    where: { id },
    include: {
      contractor: true,
      lead: { include: { projectType: true } },
    },
  });
  if (!match) notFound();
  // Ownership guard for contractor role.
  if (session.role === "contractor" && match.contractorId !== session.contractorId) {
    notFound();
  }

  const { lead, contractor } = match;
  const expired =
    match.status === "EXPIRED" ||
    lead.status === "EXPIRED" ||
    lead.expiresAt.getTime() <= Date.now();
  const accepted = match.status === "ACCEPTED";
  const declined = match.status === "DECLINED";

  return (
    <div className="flex flex-col gap-5">
      <Link href="/home" className="flex items-center gap-1 text-sm text-text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text">{lead.projectType.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-base text-text-muted">
              <MapPin className="h-4 w-4" /> {lead.propertyLocation}
            </p>
          </div>
          <LeadMatchStatusBadge status={match.status} />
        </div>

        <div className="flex items-center gap-3">
          <TierBadge tier={lead.tier} />
          {!accepted && !expired && (
            <span className="text-sm text-text-muted">{timeUntil(lead.expiresAt)}</span>
          )}
        </div>

        <div className="rounded-md bg-primary-soft p-4">
          <p className="text-sm text-text-muted">Lead price</p>
          <p className="text-2xl font-semibold tabular-nums text-text">
            {formatMoney(lead.priceCents)}
          </p>
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-sm text-text-muted">Your wallet balance</p>
            <WalletBalance cents={contractor.walletBalanceCents} size="md" />
            {!accepted && !declined && !expired && contractor.walletBalanceCents < lead.priceCents && (
              <Button asChild variant="accent" size="sm" className="mt-3 w-full">
                <Link href="/wallet">Add funds to accept</Link>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {accepted ? (
        <Card className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" /> You accepted this lead
          </p>
          <p className="text-sm text-text-muted">Here is the landowner&apos;s contact info:</p>
          <p className="mt-1 text-lg font-semibold text-text">{lead.landownerName}</p>
          <a
            href={`tel:${lead.landownerPhone}`}
            className="flex min-h-tap items-center gap-2 text-text"
          >
            <Phone className="h-5 w-5 text-primary" /> {lead.landownerPhone}
          </a>
          <a
            href={`mailto:${lead.landownerEmail}`}
            className="flex min-h-tap items-center gap-2 text-text"
          >
            <Mail className="h-5 w-5 text-primary" /> {lead.landownerEmail}
          </a>
        </Card>
      ) : expired ? (
        <p className="rounded-md bg-danger-soft p-4 text-center text-sm font-medium text-danger">
          This lead has expired and can no longer be accepted.
        </p>
      ) : declined ? (
        <p className="rounded-md bg-primary-soft p-4 text-center text-sm font-medium text-text-muted">
          You passed on this lead.
        </p>
      ) : (
        <LeadActions matchId={match.id} />
      )}
    </div>
  );
}
