import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TierBadge } from "@/components/tier-badge";
import { LeadMatchStatusBadge } from "@/components/status-badge";
import { LeadCardCta } from "@/components/lead-card-cta";
import { formatMoney } from "@/lib/money";
import { timeUntil } from "@/lib/format";

export type FeedLead = {
  matchId: string;
  status: string;
  projectTypeName: string;
  location: string;
  tier: number;
  priceCents: number;
  expiresAt: Date;
  contact?: {
    name: string;
    phone: string;
    email: string;
  } | null;
};

export function LeadFeedCard({ lead }: { lead: FeedLead }) {
  const accepted = lead.status === "ACCEPTED";

  const body = (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-text">{lead.projectTypeName}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
            <MapPin className="h-4 w-4" /> {lead.location}
          </p>
        </div>
        <LeadMatchStatusBadge status={lead.status} />
      </div>

      <div className="flex items-center justify-between">
        <TierBadge tier={lead.tier} />
        <span className="text-2xl font-semibold tabular-nums text-text">
          {formatMoney(lead.priceCents)}
        </span>
      </div>

      {accepted && lead.contact ? (
        <div className="rounded-sm bg-success-soft p-3 text-sm">
          <p className="font-semibold text-success">Contact unlocked</p>
          <p className="mt-1 font-medium text-text">{lead.contact.name}</p>
          <a href={`tel:${lead.contact.phone}`} className="mt-1 flex items-center gap-1 text-text">
            <Phone className="h-4 w-4" /> {lead.contact.phone}
          </a>
          <a href={`mailto:${lead.contact.email}`} className="flex items-center gap-1 text-text">
            <Mail className="h-4 w-4" /> {lead.contact.email}
          </a>
        </div>
      ) : (
        <LeadCardCta timeLabel={timeUntil(lead.expiresAt)} />
      )}
    </Card>
  );

  if (accepted) return body;
  return (
    <Link href={`/leads/${lead.matchId}`} className="block">
      {body}
    </Link>
  );
}
