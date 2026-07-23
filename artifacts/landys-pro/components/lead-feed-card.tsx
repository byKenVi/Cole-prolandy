"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Hammer } from "lucide-react";
import { iconSrcFor } from "@/lib/project-icons";
import { tierPill } from "@/lib/tier-style";
import { formatMoney } from "@/lib/money";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { OneClickAccept } from "@/components/one-click-accept";

/**
 * Stacked lead card for the mobile (< md) contractor feed and "My leads"
 * views. Mirrors the warm Landys palette of the desktop table rows. Renders a
 * tappable link to the lead when pending, or a static "contact unlocked" card
 * once accepted.
 */
export type FeedLead = {
  matchId: string;
  status?: string;
  projectTypeName: string;
  categoryName?: string | null;
  categoryIcon?: string | null;
  location: string;
  tier: number;
  priceCents: number;
  receivedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  walletCents?: number | null;
  hasSavedCard?: boolean;
  contact?: {
    name: string;
    phone: string;
    email?: string;
  } | null;
};

function CardIcon({ lead }: { lead: FeedLead }) {
  const src = iconSrcFor({
    icon: lead.categoryIcon,
    category: lead.categoryName,
    project: lead.projectTypeName,
  });
  return (
    <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px] bg-[#F5EEDF]">
      {src ? (
        <Image src={src} alt="" aria-hidden width={60} height={60} className="h-[30px] w-[30px] object-contain" />
      ) : (
        <Hammer className="h-[26px] w-[26px] text-[#9A6E2E]" aria-hidden />
      )}
    </span>
  );
}

function TierPill({ tier }: { tier: number }) {
  const pill = tierPill(tier);
  return (
    <span
      className="whitespace-nowrap rounded-full px-[10px] py-1.5 text-[11px] font-semibold"
      style={{ color: pill.color, background: pill.background }}
    >
      {pill.label}
    </span>
  );
}

export function LeadFeedCard({ lead }: { lead: FeedLead }) {
  const accepted = lead.status === "ACCEPTED";

  const head = (
    <div className="flex items-start gap-[13px]">
      <CardIcon lead={lead} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold leading-[1.25] text-[#3A352D]">
          {lead.projectTypeName}
        </p>
        {lead.categoryName && (
          <p className="mt-0.5 truncate text-[13px] leading-[1.2] text-[#8A7E68]">{lead.categoryName}</p>
        )}
        <p className="mt-1 flex items-center gap-[5px] text-[13px] font-medium text-[#5A4E3E]">
          <MapPin className="h-[14px] w-[14px] flex-none text-[#B0A691]" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{lead.location}</span>
        </p>
      </div>
      {!accepted && lead.expiresAt && (
        <ExpiryCountdown expiresAt={lead.expiresAt} variant="badge" />
      )}
    </div>
  );

  if (accepted) {
    return (
      <div className="rounded-[16px] border border-[#EBE3D4] bg-white p-4 shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
        {head}
        {lead.contact && (
          <div className="mt-3 rounded-[12px] bg-[#F5EEDF] p-3">
            <p className="truncate text-[14px] font-semibold text-[#3A352D]">{lead.contact.name}</p>
            <a
              href={`tel:${lead.contact.phone}`}
              className="mt-1 flex items-center gap-[6px] text-[13px] font-medium text-[#8A6B2E] hover:underline"
            >
              <Phone className="h-[14px] w-[14px] flex-none" strokeWidth={1.7} aria-hidden />
              <span className="truncate">{lead.contact.phone}</span>
            </a>
            {lead.contact.email && (
              <a
                href={`mailto:${lead.contact.email}`}
                className="mt-1 flex items-center gap-[6px] text-[13px] font-medium text-[#8A6B2E] hover:underline"
              >
                <Mail className="h-[14px] w-[14px] flex-none" strokeWidth={1.7} aria-hidden />
                <span className="truncate">{lead.contact.email}</span>
              </a>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#F2EBDD] pt-3">
          <TierPill tier={lead.tier} />
          <span className="text-[19px] font-semibold tabular-nums text-[#3A352D]">
            {formatMoney(lead.priceCents)}
          </span>
        </div>
      </div>
    );
  }

  // Pending card — header links to detail, footer has View + Accept actions.
  return (
    <div className="rounded-[16px] border border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)] transition-colors hover:bg-[#FBF6EC]">
      <Link href={`/leads/${lead.matchId}`} className="block p-4 pb-3">
        {head}
      </Link>
      <div className="flex items-center justify-between gap-3 border-t border-[#F2EBDD] px-4 pb-4 pt-3">
        <div className="flex items-center gap-2">
          <TierPill tier={lead.tier} />
          <span className="text-[19px] font-semibold tabular-nums text-[#3A352D]">
            {formatMoney(lead.priceCents)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/leads/${lead.matchId}`}
            className="inline-flex h-[38px] items-center gap-1 whitespace-nowrap rounded-[10px] border border-[#EAD9BC] bg-[#FBF3E6] px-[13px] text-[13px] font-semibold text-[#9A6E2E] transition-colors hover:border-[#C0803C] hover:bg-[#C0803C] hover:text-white"
          >
            View
          </Link>
          {lead.walletCents != null && (
            <OneClickAccept
              matchId={lead.matchId}
              priceCents={lead.priceCents}
              walletCents={lead.walletCents}
              hasSavedCard={lead.hasSavedCard ?? false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
