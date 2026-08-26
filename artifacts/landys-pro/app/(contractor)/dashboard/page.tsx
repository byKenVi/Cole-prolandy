import Link from "next/link";
import { ChevronRight, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { loadSuccessFeeTiers, resolveSuccessFeeForValue } from "@/lib/domain/success-fee";
import {
  hasResolvedLeadSnapshot,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";
import { LeadFeedCard } from "@/components/lead-feed-card";
import { FeePayButton } from "@/components/fee-pay-button";

export const dynamic = "force-dynamic";

function estimatedValueCents(lead: { budgetCents: number | null; priceCents: number | null }) {
  return lead.budgetCents ?? lead.priceCents;
}

export default async function ContractorDashboard() {
  const session = await getSession();
  if (!session.contractorId) {
    return (
      <div className="contractor-page px-4 py-10 sm:px-5 md:px-[34px]">
        <p className="text-[15px] text-[#6B6459]">Complete your profile to see your dashboard.</p>
      </div>
    );
  }

  const contractorId = session.contractorId;

  const [pendingOpportunities, acceptedJobs, feesDue, topOpportunities, dueFees, tiers] =
    await Promise.all([
      prisma.leadMatch.count({ where: { contractorId, status: "PENDING" } }),
      prisma.leadMatch.count({ where: { contractorId, status: "ACCEPTED" } }),
      prisma.successFee.count({
        where: { status: "DUE", leadMatch: { contractorId } },
      }),
      prisma.leadMatch.findMany({
        where: { contractorId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { lead: { include: leadDisplayInclude } },
      }),
      prisma.successFee.findMany({
        where: { status: "DUE", leadMatch: { contractorId } },
        orderBy: { dueAt: "asc" },
        take: 2,
        include: { leadMatch: { include: { lead: { include: leadDisplayInclude } } } },
      }),
      loadSuccessFeeTiers(prisma),
    ]);

  const opportunityCards = topOpportunities.flatMap((m) => {
    if (!hasResolvedLeadSnapshot(m.lead)) return [];
    const estimate = estimatedValueCents(m.lead);
    let feeRatePercent: number | undefined;
    if (estimate && estimate > 0 && tiers.length > 0) {
      try {
        feeRatePercent = resolveSuccessFeeForValue(tiers, estimate).rateBasisPoints / 100;
      } catch {
        /* non-fatal */
      }
    }
    return [
      {
        matchId: m.id,
        projectTypeName: leadScopeLabel(m.lead),
        categoryName: leadCategoryLabel(m.lead),
        location: m.lead.propertyLocation,
        tier: m.lead.tier,
        feeRatePercent,
        estimatedValueLabel: estimate && estimate > 0 ? formatMoney(estimate) : null,
        expiresAt: m.lead.expiresAt,
      },
    ];
  });

  return (
    <div className="contractor-page px-4 py-6 sm:px-5 md:px-[34px] md:py-8">
      <header className="mb-6">
        <h1 className="font-fraunces text-[26px] font-semibold tracking-[-0.01em] text-[#3A352D] sm:text-[30px]">
          Dashboard
        </h1>
        <p className="mt-[5px] text-[15px] text-[#8A7E68]">
          {pendingOpportunities > 0
            ? `${pendingOpportunities} new ${pendingOpportunities === 1 ? "opportunity needs" : "opportunities need"} your response`
            : "You're caught up — check back when new work comes in"}
        </p>
      </header>

      {feesDue > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-[16px] border border-[#E8C4BE] bg-[#F6E4E1] px-4 py-4 sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-[#9A3B2E]" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-[#9A3B2E]">
                {feesDue} success {feesDue === 1 ? "fee" : "fees"} ready to pay
              </p>
              <p className="mt-0.5 text-[13px] text-[#7A4A42]">
                Pay Landy&apos;s after the landowner has paid you.
              </p>
            </div>
          </div>
          <Link
            href="/fees"
            className="contractor-action-primary flex-none whitespace-nowrap"
          >
            Pay fees
          </Link>
        </div>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <QuickStat label="New opportunities" count={pendingOpportunities} href="/opportunities" />
        <QuickStat label="Active jobs" count={acceptedJobs} href="/jobs" />
        <QuickStat label="Fees due" count={feesDue} href="/fees" accent={feesDue > 0} />
      </div>

      {dueFees.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Fees due" href="/fees" />
          <div className="mt-3 flex flex-col gap-3">
            {dueFees.map((fee) => (
              <div
                key={fee.id}
                className="contractor-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-[#3A352D]">
                    {leadScopeLabel(fee.leadMatch.lead)}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#8A7E68]">
                    {formatMoney(fee.feeAmountCents)} · {fee.rateBasisPoints / 100}% of{" "}
                    {formatMoney(fee.finalValueCents)}
                  </p>
                </div>
                <FeePayButton
                  leadMatchId={fee.leadMatchId}
                  amountLabel={formatMoney(fee.feeAmountCents)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          title="Respond now"
          href="/opportunities"
          subtitle={
            pendingOpportunities > 0
              ? "Accept or pass — contact details unlock after you accept"
              : undefined
          }
        />
        {opportunityCards.length === 0 ? (
          <div className="contractor-card mt-3 px-6 py-12 text-center">
            <p className="font-fraunces text-[20px] font-medium text-[#3A352D]">No pending opportunities</p>
            <p className="mt-2 text-[14px] text-[#6B6459]">
              New matched jobs will appear here and by text.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {opportunityCards.map((o) => (
              <LeadFeedCard
                key={o.matchId}
                lead={{
                  matchId: o.matchId,
                  projectTypeName: o.projectTypeName,
                  categoryName: o.categoryName,
                  location: o.location,
                  tier: o.tier,
                  feeRatePercent: o.feeRatePercent,
                  estimatedValueLabel: o.estimatedValueLabel,
                  expiresAt: o.expiresAt,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuickStat({
  label,
  count,
  href,
  accent = false,
}: {
  label: string;
  count: number;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between rounded-[16px] border px-4 py-4 transition-colors ${
        accent
          ? "border-[#E8C4BE] bg-[#FDF5F3] hover:border-[#C0803C]"
          : "border-[#EBE3D4] bg-white hover:border-[#C0803C] hover:bg-[#FBF6EC]"
      }`}
    >
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A7E68]">{label}</p>
        <p className="mt-1 font-fraunces text-[32px] font-semibold leading-none tabular-nums text-[#4A3E2D]">
          {count}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-[#B0A691] group-hover:text-[#C0803C]" aria-hidden />
    </Link>
  );
}

function SectionHeader({
  title,
  href,
  subtitle,
}: {
  title: string;
  href: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="font-fraunces text-[20px] font-semibold text-[#3A352D]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-[#8A7E68]">{subtitle}</p>}
      </div>
      <Link href={href} className="text-[13px] font-semibold text-[#C0803C] hover:underline">
        View all
      </Link>
    </div>
  );
}
