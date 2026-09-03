import Image from "next/image";
import Link from "next/link";
import { MapPin, Hammer, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { iconSrcFor } from "@/lib/project-icons";
import { OpportunityCard } from "@/components/opportunity-card";
import { formatMoney } from "@/lib/money";
import {
  hasResolvedLeadSnapshot,
  leadCategoryIcon,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

type JobRow = {
  matchId: string;
  projectTypeName: string;
  categoryName: string;
  categoryIcon: string | null;
  location: string;
  estimatedValueLabel: string | null;
  group: GroupKey;
  statusLabel: string;
  statusTone: "neutral" | "warn" | "danger" | "success";
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

type GroupKey = "fee_due" | "awaiting_pay" | "accepted" | "won" | "lost" | "paid";

const GROUP_ORDER: GroupKey[] = [
  "fee_due",
  "awaiting_pay",
  "accepted",
  "won",
  "lost",
  "paid",
];

const GROUP_META: Record<GroupKey, { title: string; hint: string }> = {
  fee_due: {
    title: "Fee due",
    hint: "Landowner paid you — pay Landy's success fee",
  },
  awaiting_pay: {
    title: "Waiting for landowner payment",
    hint: "You won the job. Confirm when you've been paid.",
  },
  accepted: {
    title: "Accepted",
    hint: "Contact unlocked — work with the landowner off-platform",
  },
  won: {
    title: "Won",
    hint: "Marked won — waiting on the payment check-in",
  },
  lost: {
    title: "Lost",
    hint: "Jobs you passed on after connecting",
  },
  paid: {
    title: "Completed / paid",
    hint: "Landy's fee settled",
  },
};

function classify(match: {
  jobOutcome: string;
  successFee: { status: string } | null;
}): { group: GroupKey; statusLabel: string; statusTone: JobRow["statusTone"] } {
  const fee = match.successFee?.status;
  if (fee === "DUE") return { group: "fee_due", statusLabel: "Fee due", statusTone: "danger" };
  if (fee === "PAID") return { group: "paid", statusLabel: "Fee paid", statusTone: "success" };
  if (fee === "AWAITING_CONTRACTOR_PAYMENT") {
    return {
      group: "awaiting_pay",
      statusLabel: "Waiting for landowner payment",
      statusTone: "warn",
    };
  }
  if (match.jobOutcome === "WON") return { group: "won", statusLabel: "Won", statusTone: "success" };
  if (match.jobOutcome === "LOST") return { group: "lost", statusLabel: "Lost", statusTone: "neutral" };
  return { group: "accepted", statusLabel: "Accepted", statusTone: "neutral" };
}

export default async function MyJobsPage() {
  const session = await getSession();
  if (!session.contractorId) {
    return <Shell groups={[]} totalCount={0} />;
  }

  const matches = await prisma.leadMatch.findMany({
    where: { contractorId: session.contractorId, status: "ACCEPTED" },
    orderBy: { acceptedAt: "desc" },
    include: {
      successFee: { select: { status: true, feeAmountCents: true } },
      lead: { include: leadDisplayInclude },
    },
  });

  const rows: JobRow[] = matches.flatMap((m) => {
    if (!hasResolvedLeadSnapshot(m.lead)) return [];
    const classified = classify(m);
    const estimate = m.lead.budgetCents ?? m.lead.priceCents;
    return [
      {
        matchId: m.id,
        projectTypeName: leadScopeLabel(m.lead),
        categoryName: leadCategoryLabel(m.lead),
        categoryIcon: leadCategoryIcon(m.lead) ?? null,
        location: m.lead.propertyLocation,
        estimatedValueLabel: estimate && estimate > 0 ? formatMoney(estimate) : null,
        ...classified,
        contactName:
          m.lead.landownerName ||
          [m.lead.firstName, m.lead.lastName].filter(Boolean).join(" ") ||
          "Landowner",
        contactPhone: m.lead.landownerPhone ?? "",
        contactEmail: m.lead.landownerEmail,
      },
    ];
  });

  const groups = GROUP_ORDER.map((key) => ({
    key,
    ...GROUP_META[key],
    rows: rows.filter((r) => r.group === key),
  })).filter((g) => g.rows.length > 0);

  return <Shell groups={groups} totalCount={rows.length} />;
}

function Shell({
  groups,
  totalCount,
}: {
  groups: Array<{
    key: GroupKey;
    title: string;
    hint: string;
    rows: JobRow[];
  }>;
  totalCount: number;
}) {
  return (
    <div className="contractor-page flex min-h-full flex-col">
      <header className="border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:px-[34px] md:pt-7">
        <h1 className="font-fraunces text-[28px] font-semibold tracking-[-0.01em] text-[#4A3E2D] sm:text-[32px]">
          My Jobs
        </h1>
        <p className="mt-1.5 max-w-[44ch] text-[15px] leading-relaxed text-[#8A7E68]">
          {totalCount === 0
            ? "Accepted opportunities show up here with the landowner's contact."
            : `${totalCount} connected ${totalCount === 1 ? "job" : "jobs"} — grouped by what needs attention.`}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-8 px-4 py-6 sm:px-5 md:px-[34px]">
        {totalCount === 0 ? (
          <Empty />
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              <div className="mb-3">
                <h2 className="font-fraunces text-[20px] font-semibold text-[#4A3E2D]">
                  {group.title}
                  <span className="ml-2 text-[14px] font-medium text-[#8A7E68]">
                    {group.rows.length}
                  </span>
                </h2>
                <p className="mt-0.5 text-[13px] text-[#8A7E68]">{group.hint}</p>
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {group.rows.map((r) => (
                  <OpportunityCard
                    key={r.matchId}
                    lead={{
                      matchId: r.matchId,
                      status: "ACCEPTED",
                      projectTypeName: r.projectTypeName,
                      categoryName: r.categoryName,
                      categoryIcon: r.categoryIcon,
                      location: r.location,
                      estimatedValueLabel: r.estimatedValueLabel,
                      statusLabel: r.statusLabel,
                      statusTone: r.statusTone,
                      contact: r.contactPhone
                        ? {
                            name: r.contactName,
                            phone: r.contactPhone,
                            email: r.contactEmail,
                          }
                        : null,
                    }}
                  />
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-[18px] border border-[#EBE3D4] bg-white md:block">
                {group.rows.map((r) => (
                  <DesktopJobRow key={r.matchId} row={r} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function DesktopJobRow({ row }: { row: JobRow }) {
  const src = iconSrcFor({
    icon: row.categoryIcon,
    category: row.categoryName,
    project: row.projectTypeName,
  });
  return (
    <Link
      href={`/jobs/${row.matchId}`}
      className="group flex items-center gap-4 border-b border-[#F2EBDD] px-5 py-4 last:border-b-0 hover:bg-[#FBF6EC]"
    >
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#F5EEDF]">
        {src ? (
          <Image src={src} alt="" aria-hidden width={60} height={60} className="h-8 w-8 object-contain" />
        ) : (
          <Hammer className="h-7 w-7 text-[#9A6E2E]" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-[#4A3E2D] group-hover:text-[#C0803C]">
          {row.projectTypeName}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#8A7E68]">
          <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden />
          <span className="truncate">{row.location}</span>
        </p>
      </div>
      <span
        className={`contractor-status-chip ${
          row.statusTone === "danger"
            ? "bg-[#F6E4E1] text-[#9A3B2E]"
            : row.statusTone === "warn"
              ? "bg-[#F8E8C8] text-[#8A5A18]"
              : row.statusTone === "success"
                ? "bg-[#E8F0EA] text-[#2F4A3C]"
                : "bg-[#F1E8D8] text-[#5A4E3E]"
        }`}
      >
        {row.statusLabel}
      </span>
      <ChevronRight className="h-4 w-4 flex-none text-[#B0A691] group-hover:text-[#C0803C]" aria-hidden />
    </Link>
  );
}

function Empty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[20px] border border-[#EBE3D4] bg-white px-8 py-16 text-center">
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] bg-[#F5EEDF]">
        <Image
          src="/empty-leads-3d.png"
          alt=""
          aria-hidden
          width={112}
          height={112}
          className="h-12 w-12 object-contain opacity-60"
        />
      </span>
      <p className="mb-2 font-fraunces text-[24px] font-medium text-[#4A3E2D]">No accepted jobs yet</p>
      <p className="max-w-[40ch] text-[15px] leading-relaxed text-[#6B6459]">
        When you accept an opportunity, it lands here with the landowner&apos;s contact — no project
        tracker to maintain.
      </p>
      <Link href="/opportunities" className="contractor-action-primary mt-6">
        Browse opportunities
      </Link>
    </div>
  );
}
