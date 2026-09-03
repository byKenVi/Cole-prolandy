"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";
import { iconSrcFor } from "@/lib/project-icons";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { OneClickAccept } from "@/components/one-click-accept";
import { OneClickPass } from "@/components/one-click-pass";

/** Success-fee opportunity / job card — no pay-per-lead tier language. */
export type OpportunityCardData = {
  matchId: string;
  status?: string;
  projectTypeName: string;
  categoryName?: string | null;
  categoryIcon?: string | null;
  location: string;
  description?: string | null;
  landTypeName?: string | null;
  feeRatePercent?: number;
  estimatedValueLabel?: string | null;
  expiresAt?: Date | string | null;
  contact?: {
    name: string;
    phone: string;
    email?: string;
  } | null;
  /** Optional status chip for accepted/active jobs views */
  statusLabel?: string | null;
  statusTone?: "neutral" | "warn" | "danger" | "success";
};

function formatFeeRate(rate: number | undefined): string {
  if (rate == null) return "—";
  return rate % 1 === 0 ? `${rate.toFixed(0)}%` : `${rate.toFixed(1)}%`;
}

function detailHref(lead: OpportunityCardData): string {
  return lead.status === "ACCEPTED" ? `/jobs/${lead.matchId}` : `/opportunities/${lead.matchId}`;
}

function CardIcon({ lead }: { lead: OpportunityCardData }) {
  const src = iconSrcFor({
    icon: lead.categoryIcon,
    category: lead.categoryName,
    project: lead.projectTypeName,
  });
  return (
    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#F5EEDF]">
      <Image
        src={src}
        alt=""
        aria-hidden
        width={60}
        height={60}
        className="h-8 w-8 object-contain"
      />
    </span>
  );
}

const STATUS_TONE: Record<NonNullable<OpportunityCardData["statusTone"]>, string> = {
  neutral: "bg-[#F1E8D8] text-[#5A4E3E]",
  warn: "bg-[#F8E8C8] text-[#8A5A18]",
  danger: "bg-[#F6E4E1] text-[#9A3B2E]",
  success: "bg-[#E8F0EA] text-[#2F4A3C]",
};

export function OpportunityCard({ lead }: { lead: OpportunityCardData }) {
  const accepted = lead.status === "ACCEPTED";
  const href = detailHref(lead);
  const blurb = lead.description?.trim();

  const head = (
    <div className="flex items-start gap-3.5">
      <CardIcon lead={lead} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-fraunces text-[19px] font-semibold leading-tight text-[#4A3E2D]">
              {lead.projectTypeName}
            </p>
            {lead.categoryName && (
              <p className="mt-0.5 truncate text-[13px] text-[#8A7E68]">{lead.categoryName}</p>
            )}
          </div>
          {!accepted && lead.expiresAt && (
            <ExpiryCountdown expiresAt={lead.expiresAt} variant="badge" />
          )}
          {accepted && lead.statusLabel && (
            <span
              className={`contractor-status-chip ${STATUS_TONE[lead.statusTone ?? "neutral"]}`}
            >
              {lead.statusLabel}
            </span>
          )}
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[14px] font-medium text-[#5A4E3E]">
          <MapPin className="h-4 w-4 flex-none text-[#B0A691]" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{lead.location}</span>
        </p>

        {(lead.estimatedValueLabel || lead.feeRatePercent != null || lead.landTypeName) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
            {lead.estimatedValueLabel && (
              <span className="font-semibold text-[#4A3E2D]">
                Estimated budget {lead.estimatedValueLabel}
              </span>
            )}
            {lead.feeRatePercent != null && (
              <span className="rounded-full bg-[#F4EAD3] px-2.5 py-1 text-[12px] font-semibold text-[#8A6B2E]">
                {formatFeeRate(lead.feeRatePercent)} Landy&apos;s fee
              </span>
            )}
            {lead.landTypeName && (
              <span className="text-[13px] text-[#8A7E68]">{lead.landTypeName}</span>
            )}
          </div>
        )}

        {blurb && (
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[#6B6459]">{blurb}</p>
        )}
      </div>
    </div>
  );

  if (accepted) {
    return (
      <div className="contractor-card relative p-4 transition-colors hover:bg-[#FBF6EC] sm:p-5">
        <Link
          href={href}
          className="absolute inset-0 z-0 rounded-[18px]"
          aria-label={`View ${lead.projectTypeName}`}
        />
        <div className="relative z-[1] pointer-events-none">{head}</div>
        {lead.contact && (
          <div className="relative z-10 mt-3 rounded-[14px] bg-[#F5EEDF] p-3.5">
            <p className="truncate text-[15px] font-semibold text-[#3A352D]">{lead.contact.name}</p>
            <a
              href={`tel:${lead.contact.phone}`}
              className="mt-1.5 flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[#8A6B2E] hover:underline"
            >
              <Phone className="h-4 w-4 flex-none" strokeWidth={1.7} aria-hidden />
              <span className="truncate">{lead.contact.phone}</span>
            </a>
            {lead.contact.email && (
              <a
                href={`mailto:${lead.contact.email}`}
                className="mt-1 flex min-h-10 items-center gap-2 text-[14px] font-medium text-[#8A6B2E] hover:underline"
              >
                <Mail className="h-4 w-4 flex-none" strokeWidth={1.7} aria-hidden />
                <span className="truncate">{lead.contact.email}</span>
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <article className="contractor-card overflow-hidden">
      <Link href={href} className="block p-4 pb-3 sm:p-5 sm:pb-3">
        {head}
      </Link>
      <div className="flex flex-col gap-3 border-t border-[#F2EBDD] bg-[#FDFAF4] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-[13px] text-[#8A7E68]">
          Contact unlocks after you accept · Work stays off-platform
        </p>
        <div className="flex flex-none items-stretch gap-2.5">
          <OneClickPass matchId={lead.matchId} />
          <div className="min-w-[132px] flex-1 sm:flex-none [&_button]:h-12 [&_button]:w-full [&_button]:text-[16px]">
            <OneClickAccept matchId={lead.matchId} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** @deprecated Use OpportunityCard — kept as alias during migration. */
export { OpportunityCard as LeadFeedCard };
export type { OpportunityCardData as FeedLead };
