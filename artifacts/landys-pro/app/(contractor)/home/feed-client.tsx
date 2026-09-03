"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Search, ChevronDown, MessageSquare } from "lucide-react";
import { OpportunityCard } from "@/components/opportunity-card";
import { PaginationControls } from "@/components/pagination-controls";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { OneClickAccept } from "@/components/one-click-accept";
import { OneClickPass } from "@/components/one-click-pass";
import { iconSrcFor } from "@/lib/project-icons";

export type FeedRow = {
  matchId: string;
  projectTypeName: string;
  categoryName: string;
  categoryIcon: string | null;
  location: string;
  description?: string | null;
  landTypeName?: string | null;
  feeRatePercent?: number;
  estimatedFeeLabel?: string | null;
  estimatedValueLabel?: string | null;
  receivedAt: Date;
  expiresAt: Date;
};

const GRID =
  "grid-cols-[minmax(200px,2.2fr)_minmax(120px,1.1fr)_minmax(118px,0.9fr)_96px_minmax(128px,0.95fr)_minmax(196px,auto)]";

type SortOrder = "newest" | "oldest";

function formatFeeRate(rate: number | undefined): string {
  if (rate == null) return "—";
  return rate % 1 === 0 ? `${rate.toFixed(0)}%` : `${rate.toFixed(1)}%`;
}

function detailHref(matchId: string): string {
  return `/opportunities/${matchId}`;
}

export function ContractorFeed({
  rows,
  pathname = "/opportunities",
  pagination,
}: {
  rows: FeedRow[];
  pathname?: string;
  pagination?: { page: number; totalPages: number; totalCount: number; pageSize: number };
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");

  const totalOpen = pagination?.totalCount ?? rows.length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (!q) return true;
      return (
        r.projectTypeName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
    filtered.sort((a, b) => {
      const diff = a.receivedAt.getTime() - b.receivedAt.getTime();
      return sort === "newest" ? -diff : diff;
    });
    return filtered;
  }, [rows, query, sort]);

  return (
    <div className="contractor-page flex min-h-full flex-col">
      <header className="flex flex-col gap-4 border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:flex-row md:items-end md:justify-between md:px-[34px] md:pt-7">
        <div className="min-w-0">
          <h1 className="font-fraunces text-[28px] font-semibold tracking-[-0.01em] text-[#4A3E2D] sm:text-[32px]">
            Opportunities
          </h1>
          <p className="mt-1.5 max-w-[42ch] text-[15px] leading-relaxed text-[#8A7E68]">
            {totalOpen > 0
              ? `${totalOpen} open ${totalOpen === 1 ? "job" : "jobs"} matched to your trade. Accept to unlock the landowner's contact.`
              : "No open matches right now — we'll text you when something fits."}
          </p>
        </div>
        <div className="flex min-w-0 w-full items-center gap-3 md:w-auto md:flex-none">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] border border-[#E6DFD1] bg-white px-4 md:w-[260px] md:flex-none">
            <Search className="h-[18px] w-[18px] flex-none text-[#8A7E68]" strokeWidth={1.8} aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs or towns"
              aria-label="Search jobs or towns"
              className="min-w-0 flex-1 border-none bg-transparent text-[16px] text-[#3A352D] outline-none placeholder:text-[#8A7E68] md:text-[15px]"
            />
          </label>
          <button
            type="button"
            onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
            aria-label={`Sort by date: ${sort === "newest" ? "newest first" : "oldest first"}`}
            className="flex h-12 flex-none items-center justify-center gap-1.5 rounded-[14px] border border-[#E6DFD1] bg-white px-3.5 text-[13px] font-semibold text-[#5A4E3E] hover:bg-[#F7F0E3]"
          >
            {sort === "newest" ? "Newest" : "Oldest"}
            <ChevronDown className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 py-5 sm:px-5 md:px-[34px] md:py-6">
        {totalOpen === 0 ? (
          <EmptyFeed />
        ) : shown.length === 0 ? (
          <NoMatches />
        ) : (
          <>
            <div className="contractor-table-mobile flex flex-col gap-3.5">
              {shown.map((r) => (
                <OpportunityCard
                  key={r.matchId}
                  lead={{
                    matchId: r.matchId,
                    status: "PENDING",
                    projectTypeName: r.projectTypeName,
                    categoryName: r.categoryName,
                    categoryIcon: r.categoryIcon,
                    location: r.location,
                    description: r.description,
                    landTypeName: r.landTypeName,
                    feeRatePercent: r.feeRatePercent,
                    estimatedValueLabel: r.estimatedValueLabel,
                    expiresAt: r.expiresAt,
                  }}
                />
              ))}
            </div>

            <div className="contractor-table-desktop rounded-[18px] border border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
              <div className="overflow-x-auto">
                <div
                  className={`grid ${GRID} min-w-[980px] items-center gap-3.5 border-b border-[#EEE6D6] bg-[#FAF4E9] px-6 py-3.5`}
                >
                  <HeadCell>Job</HeadCell>
                  <HeadCell>Location</HeadCell>
                  <HeadCell>Estimated budget</HeadCell>
                  <HeadCell>Expiration</HeadCell>
                  <HeadCell>Landy&apos;s success fee</HeadCell>
                  <HeadCell className="text-right">Actions</HeadCell>
                </div>
                {shown.map((r) => (
                  <FeedTableRow key={r.matchId} row={r} />
                ))}
              </div>
              <div className="bg-[#FAF4E9] px-6 py-3.5 text-[13px] text-[#8A7E68]">
                Showing {shown.length} on this page · {totalOpen} open total · No upfront lead cost
              </div>
            </div>

            {pagination && (
              <PaginationControls
                variant="contractor"
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                pageSize={pagination.pageSize}
                pathname={pathname}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HeadCell({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8A7E68] ${className}`}>
      {children}
    </span>
  );
}

function FeedTableRow({ row }: { row: FeedRow }) {
  const src = iconSrcFor({
    icon: row.categoryIcon,
    category: row.categoryName,
    project: row.projectTypeName,
  });
  const href = detailHref(row.matchId);

  return (
    <div
      className={`group grid ${GRID} min-w-[980px] items-center gap-3.5 border-b border-[#F2EBDD] px-6 last:border-b-0 hover:bg-[#FBF6EC] transition-colors`}
    >
      <Link href={href} className="flex min-w-0 items-center gap-3.5 py-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#F5EEDF]">
          <Image src={src} alt="" aria-hidden width={60} height={60} className="h-8 w-8 object-contain" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-[#4A3E2D]">{row.projectTypeName}</p>
          <p className="mt-0.5 truncate text-[13px] text-[#8A7E68]">{row.categoryName}</p>
        </div>
      </Link>

      <Link href={href} className="py-4">
        <p className="flex items-center gap-1.5 text-[14px] font-medium text-[#5A4E3E]">
          <MapPin className="h-3.5 w-3.5 flex-none text-[#B0A691]" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{row.location}</span>
        </p>
      </Link>

      <Link href={href} className="py-4 text-[15px] font-semibold tabular-nums text-[#4A3E2D]">
        {row.estimatedValueLabel ?? "—"}
      </Link>

      <Link href={href} className="py-4">
        <ExpiryCountdown expiresAt={row.expiresAt} variant="inline" />
      </Link>

      <Link href={href} className="py-4 pr-2">
        <p className="text-[15px] font-semibold tabular-nums text-[#4A3E2D]">
          {row.estimatedFeeLabel ?? formatFeeRate(row.feeRatePercent)}
        </p>
        {row.estimatedFeeLabel && row.feeRatePercent != null && (
          <p className="mt-0.5 text-[11px] text-[#8A7E68]">{formatFeeRate(row.feeRatePercent)}</p>
        )}
      </Link>

      <div className="flex items-center justify-end gap-2 py-4 pl-2">
        <OneClickPass matchId={row.matchId} />
        <OneClickAccept matchId={row.matchId} />
      </div>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-[#EBE3D4] bg-white px-8 py-16 text-center shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#F5EEDF]">
        <Image
          src="/empty-leads-3d.png"
          alt=""
          aria-hidden
          width={112}
          height={112}
          className="h-12 w-12 select-none object-contain opacity-60"
        />
      </span>
      <p className="mb-2 font-fraunces text-[24px] font-medium text-[#4A3E2D]">
        No new opportunities right now
      </p>
      <p className="mb-5 max-w-[40ch] text-[15px] leading-relaxed text-[#6B6459]">
        We&apos;ll text you when a job near you is ready. You only pay Landy&apos;s if you win and get paid.
      </p>
      <span className="flex items-center gap-2 rounded-full bg-[#F4EAD3] px-4 py-2.5 text-[13px] font-medium text-[#8A6B2E]">
        <MessageSquare className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        Alerts on for your service area
      </span>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[18px] border border-[#EBE3D4] bg-white px-8 py-14 text-center">
      <p className="mb-2 font-fraunces text-[20px] font-medium text-[#4A3E2D]">No matches for that search</p>
      <p className="max-w-[36ch] text-[15px] leading-relaxed text-[#6B6459]">
        Try another town or clear the search box.
      </p>
    </div>
  );
}
