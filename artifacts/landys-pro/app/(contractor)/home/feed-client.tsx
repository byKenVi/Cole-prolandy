"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Search, ChevronDown, Hammer, MessageSquare } from "lucide-react";
import { LeadFeedCard } from "@/components/lead-feed-card";
import { PaginationControls } from "@/components/pagination-controls";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { OneClickAccept } from "@/components/one-click-accept";
import { OneClickPass } from "@/components/one-click-pass";
import { iconSrcFor } from "@/lib/project-icons";
import { tierPill } from "@/lib/tier-style";

export type FeedRow = {
  matchId: string;
  projectTypeName: string;
  categoryName: string;
  categoryIcon: string | null;
  location: string;
  tier: number;
  feeRatePercent?: number;
  estimatedValueLabel?: string | null;
  receivedAt: Date;
  expiresAt: Date;
};

const GRID =
  "grid-cols-[minmax(200px,2.6fr)_minmax(130px,1.5fr)_84px_120px_110px_150px]";

type TierTab = "all" | "t1" | "t2" | "t3";
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
  const [tab, setTab] = useState<TierTab>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const totalOpen = pagination?.totalCount ?? rows.length;
  const countAll = rows.length;
  const countT1 = rows.filter((r) => r.tier === 1).length;
  const countT2 = rows.filter((r) => r.tier === 2).length;
  const countT3 = rows.filter((r) => r.tier === 3).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const byTier =
        tab === "all"
          ? true
          : tab === "t1"
            ? r.tier === 1
            : tab === "t2"
              ? r.tier === 2
              : r.tier === 3;
      if (!byTier) return false;
      if (!q) return true;
      return (
        r.projectTypeName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
      );
    });
    filtered.sort((a, b) => {
      const diff = a.receivedAt.getTime() - b.receivedAt.getTime();
      return sort === "newest" ? -diff : diff;
    });
    return filtered;
  }, [rows, query, tab, sort]);

  return (
    <div className="contractor-page flex min-h-full flex-col">
      <header className="flex flex-col gap-4 border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:flex-row md:items-center md:justify-between md:px-[34px] md:pt-[26px]">
        <div className="min-w-0">
          <h1 className="font-fraunces text-[26px] font-semibold tracking-[-0.01em] text-[#3A352D] sm:text-[30px]">
            Opportunities
          </h1>
          <p className="mt-[5px] text-[14px] text-[#8A7E68]">
            {totalOpen} open {totalOpen === 1 ? "job" : "jobs"} matched to your trade
          </p>
        </div>
        <div className="flex min-w-0 w-full items-center gap-3 md:w-auto md:flex-none">
          <label className="flex h-[44px] min-w-0 flex-1 items-center gap-[9px] rounded-[12px] border border-[#E6DFD1] bg-white px-[15px] md:w-[230px] md:flex-none">
            <Search className="h-[17px] w-[17px] flex-none text-[#8A7E68]" strokeWidth={1.8} aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs or towns"
              aria-label="Search jobs or towns"
              className="min-w-0 flex-1 border-none bg-transparent text-[16px] text-[#3A352D] outline-none placeholder:text-[#8A7E68] md:text-[14px]"
            />
          </label>
          {totalOpen > 0 && (
            <span className="inline-flex h-[44px] flex-none items-center gap-[7px] whitespace-nowrap rounded-[12px] bg-[#F4EAD3] px-[14px] text-[13px] font-semibold text-[#8A6B2E]">
              <span className="h-[7px] w-[7px] rounded-full bg-[#C0803C]" />
              {totalOpen} new
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-2.5 md:px-[34px]">
        <div
          role="tablist"
          aria-label="Filter opportunities by tier"
          className="flex w-full min-w-0 gap-0.5 overflow-x-auto rounded-[12px] bg-[#F1E8D8] p-1 [-ms-overflow-style:none] [scrollbar-width:none] md:w-auto md:flex-none [&::-webkit-scrollbar]:hidden"
        >
          <Tab label="New" count={countAll} active={tab === "all"} onSelect={() => setTab("all")} />
          <Tab label="Tier 1" count={countT1} active={tab === "t1"} onSelect={() => setTab("t1")} />
          <Tab label="Tier 2" count={countT2} active={tab === "t2"} onSelect={() => setTab("t2")} />
          <Tab label="Tier 3" count={countT3} active={tab === "t3"} onSelect={() => setTab("t3")} />
        </div>
        <button
          type="button"
          onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
          aria-label={`Sort by date received: ${sort === "newest" ? "newest first" : "oldest first"}. Tap to toggle.`}
          className="flex h-11 w-full flex-none items-center justify-center gap-[7px] rounded-[10px] border border-[#E6DFD1] bg-white px-[13px] text-[13px] font-medium text-[#5A4E3E] transition-colors hover:bg-[#F7F0E3] md:w-auto"
        >
          Sort: {sort === "newest" ? "Newest" : "Oldest"}
          <ChevronDown className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-8 sm:px-5 md:px-[34px]">
        {totalOpen === 0 ? (
          <EmptyFeed />
        ) : shown.length === 0 ? (
          <NoMatches />
        ) : (
          <>
            <div className="contractor-table-mobile gap-3">
              {shown.map((r) => (
                <LeadFeedCard
                  key={r.matchId}
                  lead={{
                    matchId: r.matchId,
                    status: "PENDING",
                    projectTypeName: r.projectTypeName,
                    categoryName: r.categoryName,
                    categoryIcon: r.categoryIcon,
                    location: r.location,
                    tier: r.tier,
                    feeRatePercent: r.feeRatePercent,
                    estimatedValueLabel: r.estimatedValueLabel,
                    receivedAt: r.receivedAt,
                    expiresAt: r.expiresAt,
                  }}
                />
              ))}
            </div>

            <div className="contractor-table-desktop overflow-hidden rounded-[18px] border border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
              <div className="overflow-x-auto">
                <div
                  className={`grid ${GRID} min-w-[760px] items-center gap-[14px] border-b border-[#EEE6D6] bg-[#FAF4E9] px-6 py-[14px]`}
                >
                  <HeadCell>Job</HeadCell>
                  <HeadCell>Location</HeadCell>
                  <HeadCell>Tier</HeadCell>
                  <HeadCell>Expires</HeadCell>
                  <HeadCell className="text-right">Success fee</HeadCell>
                  <span />
                </div>
                {shown.map((r) => (
                  <FeedTableRow key={r.matchId} row={r} />
                ))}
              </div>
              <div className="flex flex-col gap-1 bg-[#FAF4E9] px-6 py-[14px] sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[13px] text-[#8A7E68]">
                  Showing {shown.length} of {countAll} on this page · {totalOpen} open total
                </span>
                <span className="text-[13px] font-medium text-[#8A6B2E]">
                  New jobs are texted to you the moment they come in.
                </span>
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
    <span
      className={`text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8A7E68] ${className}`}
    >
      {children}
    </span>
  );
}

function Tab({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[9px] px-[15px] py-2 text-[13px] font-semibold transition-colors ${
        active ? "bg-white text-[#3A352D] shadow-[0_1px_3px_rgba(58,53,45,0.14)]" : "text-[#8A7E68] hover:text-[#5A4E3E]"
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );
}

function FeedTableRow({ row }: { row: FeedRow }) {
  const src = iconSrcFor({
    icon: row.categoryIcon,
    category: row.categoryName,
    project: row.projectTypeName,
  });
  const pill = tierPill(row.tier);
  const href = detailHref(row.matchId);

  return (
    <div
      className={`group grid ${GRID} min-w-[760px] items-center gap-[14px] border-b border-[#F2EBDD] px-6 last:border-b-0 hover:bg-[#FBF6EC] transition-colors`}
    >
      <Link href={href} className="flex min-w-0 items-center gap-[14px] py-[15px]">
        <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px] bg-[#F5EEDF]">
          {src ? (
            <Image
              src={src}
              alt=""
              aria-hidden
              width={60}
              height={60}
              className="h-[30px] w-[30px] object-contain"
            />
          ) : (
            <Hammer className="h-[26px] w-[26px] text-[#9A6E2E]" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold leading-[1.25] text-[#3A352D]">
            {row.projectTypeName}
          </p>
          <p className="mt-0.5 truncate text-[13px] leading-[1.2] text-[#8A7E68]">{row.categoryName}</p>
          {row.estimatedValueLabel && (
            <p className="mt-0.5 truncate text-[12px] font-semibold text-[#4A3E2D]">
              Est. {row.estimatedValueLabel}
            </p>
          )}
        </div>
      </Link>

      <Link href={href} className="py-[15px]">
        <p className="flex items-center gap-[5px] text-[14px] font-medium leading-[1.3] text-[#5A4E3E]">
          <MapPin className="h-[14px] w-[14px] flex-none text-[#B0A691]" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{row.location}</span>
        </p>
      </Link>

      <Link href={href} className="py-[15px]">
        <span
          className="whitespace-nowrap rounded-full px-[10px] py-1.5 text-[11px] font-semibold"
          style={{ color: pill.color, background: pill.background }}
        >
          {pill.label}
        </span>
      </Link>

      <Link href={href} className="py-[15px]">
        <ExpiryCountdown expiresAt={row.expiresAt} variant="inline" />
      </Link>

      <Link href={href} className="py-[15px] text-right text-[19px] font-semibold tabular-nums text-[#4A3E2D]">
        {formatFeeRate(row.feeRatePercent)}
      </Link>

      <div className="flex items-center justify-end gap-2 py-[15px]">
        <OneClickPass matchId={row.matchId} />
        <OneClickAccept matchId={row.matchId} />
        <Link href={href} className="contractor-action-secondary hidden h-[48px] min-w-0 px-3 lg:inline-flex">
          Details
        </Link>
      </div>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[18px] border border-[#EBE3D4] bg-white px-10 py-16 text-center shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
      <span className="mb-6 flex h-24 w-24 items-center justify-center rounded-[24px] bg-[#F5EEDF]">
        <Image
          src="/empty-leads-3d.png"
          alt=""
          aria-hidden
          width={112}
          height={112}
          className="h-14 w-14 select-none object-contain opacity-60"
        />
      </span>
      <p className="mb-2.5 font-fraunces text-[24px] font-medium text-[#3A352D]">
        No new opportunities right now
      </p>
      <p className="mb-6 max-w-[44ch] text-[16px] leading-[1.6] text-[#6B6459]">
        We&apos;ll text you the moment a new job comes in near you. Keep your phone handy — you don&apos;t
        need to sit here and wait.
      </p>
      <span className="flex items-center gap-[9px] rounded-full bg-[#F4EAD3] px-[15px] py-2.5 text-[13px] font-medium text-[#8A6B2E]">
        <MessageSquare className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
        Alerts are on for your service area
      </span>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[18px] border border-[#EBE3D4] bg-white px-10 py-16 text-center shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
      <p className="mb-2 font-fraunces text-[20px] font-medium text-[#3A352D]">No opportunities match your search</p>
      <p className="max-w-[40ch] text-[15px] leading-[1.6] text-[#6B6459]">
        Try a different town or trade, or clear your filters.
      </p>
    </div>
  );
}
