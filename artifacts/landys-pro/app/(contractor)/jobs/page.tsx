import Image from "next/image";
import Link from "next/link";
import { MapPin, Hammer, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { iconSrcFor } from "@/lib/project-icons";
import { LeadFeedCard } from "@/components/lead-feed-card";
import { PaginationControls } from "@/components/pagination-controls";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";
import {
  hasResolvedLeadSnapshot,
  leadCategoryIcon,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

type Row = {
  matchId: string;
  projectTypeName: string;
  categoryName: string;
  categoryIcon: string | null;
  location: string;
  tier: number;
  jobOutcome: string;
  feeStatus: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

const GRID =
  "grid-cols-[minmax(180px,2fr)_minmax(120px,1.2fr)_100px_120px_36px]";

function outcomeLabel(outcome: string): { label: string; color: string; bg: string } {
  switch (outcome) {
    case "WON":
      return { label: "Won", color: "#2F4A3C", bg: "#E8F0EA" };
    case "LOST":
      return { label: "Lost", color: "#9A3B2E", bg: "#F6E4E1" };
    default:
      return { label: "Open", color: "#8A6B2E", bg: "#F4EAD3" };
  }
}

function feeStatusLabel(status: string | null): { label: string; color: string; bg: string } | null {
  if (!status) return null;
  switch (status) {
    case "DUE":
      return { label: "Fee due", color: "#9A3B2E", bg: "#F6E4E1" };
    case "PAID":
      return { label: "Fee paid", color: "#2F4A3C", bg: "#E8F0EA" };
    case "AWAITING_CONTRACTOR_PAYMENT":
      return { label: "Awaiting payment", color: "#8A6B2E", bg: "#F4EAD3" };
    default:
      return { label: status, color: "#6B6459", bg: "#F0EADD" };
  }
}

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session.contractorId) {
    return <Shell rows={[]} totalCount={0} page={1} totalPages={1} pageSize={DEFAULT_PAGE_SIZE} />;
  }

  const where = { contractorId: session.contractorId, status: "ACCEPTED" as const };
  const requestedPage = parsePage((await searchParams).page);
  const totalCount = await prisma.leadMatch.count({ where });
  const { page, skip, take, totalPages } = paginationMeta(
    totalCount,
    requestedPage,
    DEFAULT_PAGE_SIZE,
  );

  const matches = await prisma.leadMatch.findMany({
    where,
    orderBy: { acceptedAt: "desc" },
    skip,
    take,
    include: {
      successFee: { select: { status: true } },
      lead: { include: leadDisplayInclude },
    },
  });

  const rows: Row[] = matches.flatMap((m) =>
    hasResolvedLeadSnapshot(m.lead)
      ? [
          {
            matchId: m.id,
            projectTypeName: leadScopeLabel(m.lead),
            categoryName: leadCategoryLabel(m.lead),
            categoryIcon: leadCategoryIcon(m.lead) ?? null,
            location: m.lead.propertyLocation,
            tier: m.lead.tier,
            jobOutcome: m.jobOutcome,
            feeStatus: m.successFee?.status ?? null,
            contactName: m.lead.landownerName ?? "Not provided",
            contactPhone: m.lead.landownerPhone ?? "Not provided",
            contactEmail: m.lead.landownerEmail,
          },
        ]
      : [],
  );

  return (
    <Shell
      rows={rows}
      totalCount={totalCount}
      page={page}
      totalPages={totalPages}
      pageSize={DEFAULT_PAGE_SIZE}
    />
  );
}

function Shell({
  rows,
  totalCount,
  page,
  totalPages,
  pageSize,
}: {
  rows: Row[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  return (
    <div className="contractor-page flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:px-[34px] md:pt-[26px]">
        <div className="min-w-0">
          <h1 className="font-fraunces text-[26px] font-semibold tracking-[-0.01em] text-[#3A352D] sm:text-[30px]">
            My jobs
          </h1>
          <p className="mt-[5px] text-[14px] text-[#8A7E68]">
            {totalCount} accepted {totalCount === 1 ? "job" : "jobs"}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4 py-6 sm:px-5 md:px-[34px]">
        {totalCount === 0 ? (
          <Empty />
        ) : (
          <>
            <div className="contractor-table-mobile gap-3">
              {rows.map((r) => (
                <div key={r.matchId} className="flex flex-col gap-2">
                  <LeadFeedCard
                    lead={{
                      matchId: r.matchId,
                      status: "ACCEPTED",
                      projectTypeName: r.projectTypeName,
                      categoryName: r.categoryName,
                      categoryIcon: r.categoryIcon,
                      location: r.location,
                      tier: r.tier,
                      contact: {
                        name: r.contactName,
                        phone: r.contactPhone,
                        email: r.contactEmail,
                      },
                    }}
                  />
                  <div className="flex flex-wrap gap-2 px-1">
                    <StatusChip {...outcomeLabel(r.jobOutcome)} />
                    {feeStatusLabel(r.feeStatus) && (
                      <StatusChip {...feeStatusLabel(r.feeStatus)!} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="contractor-table-desktop overflow-hidden rounded-[18px] border border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
              <div className="overflow-x-auto">
                <div
                  className={`grid ${GRID} min-w-[720px] items-center gap-[14px] border-b border-[#EEE6D6] bg-[#FAF4E9] px-6 py-[14px]`}
                >
                  <Head>Job</Head>
                  <Head>Location</Head>
                  <Head>Outcome</Head>
                  <Head>Success fee</Head>
                  <span />
                </div>
                {rows.map((r) => (
                  <JobRow key={r.matchId} row={r} />
                ))}
              </div>
            </div>

            <PaginationControls
              variant="contractor"
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              pathname="/jobs"
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatusChip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="whitespace-nowrap rounded-full px-[10px] py-1.5 text-[11px] font-semibold"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  );
}

function Head({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-[0.07em] text-[#8A7E68] ${className}`}>
      {children}
    </span>
  );
}

function JobRow({ row }: { row: Row }) {
  const src = iconSrcFor({
    icon: row.categoryIcon,
    category: row.categoryName,
    project: row.projectTypeName,
  });
  const outcome = outcomeLabel(row.jobOutcome);
  const fee = feeStatusLabel(row.feeStatus);

  return (
    <Link
      href={`/jobs/${row.matchId}`}
      className={`group grid ${GRID} min-w-[720px] items-center gap-[14px] border-b border-[#F2EBDD] px-6 py-[15px] last:border-b-0 transition-colors hover:bg-[#FBF6EC]`}
    >
      <div className="flex min-w-0 items-center gap-[14px]">
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
          <p className="truncate text-[16px] font-semibold leading-[1.25] text-[#3A352D] transition-colors group-hover:text-[#C0803C]">
            {row.projectTypeName}
          </p>
          <p className="mt-0.5 truncate text-[13px] leading-[1.2] text-[#8A7E68]">{row.categoryName}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-[5px] text-[14px] font-medium leading-[1.3] text-[#5A4E3E]">
          <MapPin className="h-[14px] w-[14px] flex-none text-[#B0A691]" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{row.location}</span>
        </p>
      </div>
      <div>
        <StatusChip {...outcome} />
      </div>
      <div>
        {fee ? <StatusChip {...fee} /> : <span className="text-[13px] text-[#A79E8D]">—</span>}
      </div>
      <ChevronRight
        className="h-4 w-4 justify-self-end text-[#B0A691] transition-colors group-hover:text-[#C0803C]"
        aria-hidden
      />
    </Link>
  );
}

function Empty() {
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
      <p className="mb-2.5 font-fraunces text-[24px] font-medium text-[#3A352D]">No accepted jobs yet</p>
      <p className="max-w-[44ch] text-[16px] leading-[1.6] text-[#6B6459]">
        When you accept an opportunity, it lands here with the landowner&apos;s contact details.
      </p>
    </div>
  );
}
