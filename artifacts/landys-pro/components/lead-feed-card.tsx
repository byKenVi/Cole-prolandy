"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Hammer } from "lucide-react";
import { iconSrcFor } from "@/lib/project-icons";
import { tierPill } from "@/lib/tier-style";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { OneClickAccept } from "@/components/one-click-accept";
import { OneClickPass } from "@/components/one-click-pass";

/**
 * Stacked opportunity card for mobile contractor feeds and "My jobs" views.
 */
export type FeedLead = {
  matchId: string;
  status?: string;
  projectTypeName: string;
  categoryName?: string | null;
  categoryIcon?: string | null;
  location: string;
  tier: number;
  feeRatePercent?: number;
  estimatedValueLabel?: string | null;
  receivedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  contact?: {
    name: string;
    phone: string;
    email?: string;
  } | null;
};

function formatFeeRate(rate: number | undefined): string {
  if (rate == null) return "—";
  return rate % 1 === 0 ? `${rate.toFixed(0)}%` : `${rate.toFixed(1)}%`;
}

function detailHref(lead: FeedLead): string {
  return lead.status === "ACCEPTED" ? `/jobs/${lead.matchId}` : `/opportunities/${lead.matchId}`;
}

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
  const href = detailHref(lead);

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
        {lead.estimatedValueLabel && (
          <p className="mt-1.5 text-[14px] font-semibold text-[#4A3E2D]">
            Est. {lead.estimatedValueLabel}
            {lead.feeRatePercent != null && (
              <span className="ml-2 text-[13px] font-medium text-[#8A7E68]">
                · {formatFeeRate(lead.feeRatePercent)} success fee
              </span>
            )}
          </p>
        )}
      </div>
      {!accepted && lead.expiresAt && (
        <ExpiryCountdown expiresAt={lead.expiresAt} variant="badge" />
      )}
    </div>
  );

  if (accepted) {
    return (
      <div className="relative rounded-[16px] border border-[#EBE3D4] bg-white p-4 shadow-[0_2px_8px_rgba(58,53,45,0.05)] transition-colors hover:bg-[#FBF6EC]">
        <Link
          href={href}
          className="absolute inset-0 z-0 rounded-[16px]"
          aria-label={`View ${lead.projectTypeName}`}
        />
        <div className="relative z-[1] pointer-events-none">{head}</div>
        {lead.contact && (
          <div className="relative z-10 mt-3 rounded-[12px] bg-[#F5EEDF] p-3">
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
        <div className="relative z-[1] mt-3 flex items-center justify-between gap-3 border-t border-[#F2EBDD] pt-3 pointer-events-none">
          <TierPill tier={lead.tier} />
          {lead.feeRatePercent != null && (
            <span className="text-[15px] font-semibold text-[#4A3E2D]">
              {formatFeeRate(lead.feeRatePercent)} fee
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)] transition-colors hover:bg-[#FBF6EC]">
      <Link href={href} className="block p-4 pb-3">
        {head}
      </Link>
      <div className="flex flex-col gap-3 border-t border-[#F2EBDD] px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TierPill tier={lead.tier} />
          {!lead.estimatedValueLabel && lead.feeRatePercent != null && (
            <span className="text-[17px] font-semibold tabular-nums text-[#4A3E2D]">
              {formatFeeRate(lead.feeRatePercent)} fee
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <Link href={href} className="contractor-action-secondary hidden min-w-[88px] sm:inline-flex">
            Details
          </Link>
          <OneClickPass matchId={lead.matchId} />
          <OneClickAccept matchId={lead.matchId} />
        </div>
      </div>
    </div>
  );
}
