import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { loadSuccessFeeTiers, resolveSuccessFeeForValue } from "@/lib/domain/success-fee";
import {
  hasResolvedLeadSnapshot,
  leadCategoryIcon,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";
import { OpportunityCard } from "@/components/opportunity-card";
import { FeePayButton } from "@/components/fee-pay-button";

export const dynamic = "force-dynamic";

function estimatedValueCents(lead: { budgetCents: number | null; priceCents: number | null }) {
  return lead.budgetCents ?? lead.priceCents;
}

function jobStatus(match: {
  jobOutcome: string;
  successFee: { status: string } | null;
}): { label: string; tone: "neutral" | "warn" | "danger" | "success" } {
  const fee = match.successFee?.status;
  if (fee === "DUE") return { label: "Fee due", tone: "danger" };
  if (fee === "PAID") return { label: "Fee paid", tone: "success" };
  if (fee === "AWAITING_CONTRACTOR_PAYMENT") {
    return { label: "Waiting to be paid", tone: "warn" };
  }
  if (match.jobOutcome === "WON") return { label: "Won", tone: "success" };
  if (match.jobOutcome === "LOST") return { label: "Lost", tone: "neutral" };
  return { label: "Accepted", tone: "neutral" };
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

  const [contractor, pendingOpportunities, topOpportunities, activeJobs, dueFees, tiers] =
    await Promise.all([
      prisma.contractor.findUnique({
        where: { id: contractorId },
        select: { name: true, cardBrand: true, cardLast4: true, stripeDefaultPaymentMethodId: true },
      }),
      prisma.leadMatch.count({ where: { contractorId, status: "PENDING" } }),
      prisma.leadMatch.findMany({
        where: { contractorId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { lead: { include: leadDisplayInclude } },
      }),
      prisma.leadMatch.findMany({
        where: {
          contractorId,
          status: "ACCEPTED",
          OR: [
            { jobOutcome: "OPEN" },
            { jobOutcome: "WON" },
            { successFee: { status: { in: ["AWAITING_CONTRACTOR_PAYMENT", "DUE"] } } },
          ],
        },
        orderBy: { acceptedAt: "desc" },
        take: 4,
        include: {
          lead: { include: leadDisplayInclude },
          successFee: { select: { status: true, feeAmountCents: true } },
        },
      }),
      prisma.successFee.findMany({
        where: { status: "DUE", leadMatch: { contractorId } },
        orderBy: { dueAt: "asc" },
        take: 3,
        include: { leadMatch: { include: { lead: { include: leadDisplayInclude } } } },
      }),
      loadSuccessFeeTiers(prisma),
    ]);

  const businessName = contractor?.name?.trim() || "there";
  const firstName = businessName.split(/\s+/)[0] ?? businessName;

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
        categoryIcon: leadCategoryIcon(m.lead),
        location: m.lead.propertyLocation,
        description: m.lead.description,
        landTypeName: m.lead.landType?.name ?? null,
        feeRatePercent,
        estimatedValueLabel: estimate && estimate > 0 ? formatMoney(estimate) : null,
        expiresAt: m.lead.expiresAt,
      },
    ];
  });

  const summary =
    dueFees.length > 0
      ? `You have ${dueFees.length} Landy's ${dueFees.length === 1 ? "fee" : "fees"} ready to pay.`
      : pendingOpportunities > 0
        ? `${pendingOpportunities} new ${pendingOpportunities === 1 ? "opportunity needs" : "opportunities need"} your response.`
        : "You're caught up — we'll text you when new work comes in.";

  return (
    <div className="contractor-page px-4 py-6 sm:px-5 md:px-[34px] md:py-8">
      <header className="mb-7">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C0803C]">
          Welcome back
        </p>
        <h1 className="mt-1 font-fraunces text-[28px] font-semibold tracking-[-0.02em] text-[#4A3E2D] sm:text-[34px]">
          {firstName}
        </h1>
        <p className="mt-2 max-w-[46ch] text-[16px] leading-relaxed text-[#6B6459]">{summary}</p>
      </header>

      {dueFees.length > 0 && (
        <section className="mb-8 overflow-hidden rounded-[20px] border border-[#E8C4BE] bg-[#FDF5F3]">
          <div className="flex items-start gap-3 border-b border-[#F0D5D0] px-4 py-4 sm:px-5">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-[#9A3B2E]" aria-hidden />
            <div>
              <p className="text-[16px] font-semibold text-[#9A3B2E]">Pay Landy&apos;s</p>
              <p className="mt-0.5 text-[14px] text-[#7A4A42]">
                The landowner paid you. Landy&apos;s success fee is due.
              </p>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-[#F0D5D0]">
            {dueFees.map((fee) => (
              <div
                key={fee.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-[#4A3E2D]">
                    {leadScopeLabel(fee.leadMatch.lead)}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#8A7E68]">
                    Landy&apos;s fee {formatMoney(fee.feeAmountCents)} · {fee.rateBasisPoints / 100}% of{" "}
                    {formatMoney(fee.finalValueCents)}
                  </p>
                </div>
                <FeePayButton
                  leadMatchId={fee.leadMatchId}
                  amountLabel={formatMoney(fee.feeAmountCents)}
                  savedCard={
                    contractor?.stripeDefaultPaymentMethodId
                      ? { brand: contractor.cardBrand, last4: contractor.cardLast4 }
                      : null
                  }
                />
              </div>
            ))}
          </div>
          <div className="border-t border-[#F0D5D0] px-4 py-3 sm:px-5">
            <Link href="/fees" className="text-[13px] font-semibold text-[#9A3B2E] hover:underline">
              View all fees
            </Link>
          </div>
        </section>
      )}

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-fraunces text-[22px] font-semibold text-[#4A3E2D]">
              New opportunities
            </h2>
            <p className="mt-0.5 text-[14px] text-[#8A7E68]">
              Accept to unlock contact · Pass if it&apos;s not a fit
            </p>
          </div>
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#C0803C] hover:underline"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {opportunityCards.length === 0 ? (
          <div className="contractor-card px-6 py-12 text-center">
            <p className="font-fraunces text-[20px] font-medium text-[#4A3E2D]">
              Nothing waiting for a response
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#6B6459]">
              New matched jobs show up here and by text. No upfront cost to review them.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {opportunityCards.map((o) => (
              <OpportunityCard key={o.matchId} lead={o} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-fraunces text-[22px] font-semibold text-[#4A3E2D]">
              My active leads
            </h2>
            <p className="mt-0.5 text-[14px] text-[#8A7E68]">
              Accepted jobs and anything waiting on payment
            </p>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#C0803C] hover:underline"
          >
            My Jobs
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {activeJobs.length === 0 ? (
          <div className="contractor-card px-6 py-10 text-center">
            <p className="text-[15px] text-[#6B6459]">
              Accepted opportunities will land here with the landowner&apos;s contact.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeJobs.map((m) => {
              if (!hasResolvedLeadSnapshot(m.lead)) return null;
              const status = jobStatus(m);
              const estimate = estimatedValueCents(m.lead);
              return (
                <OpportunityCard
                  key={m.id}
                  lead={{
                    matchId: m.id,
                    status: "ACCEPTED",
                    projectTypeName: leadScopeLabel(m.lead),
                    categoryName: leadCategoryLabel(m.lead),
                    categoryIcon: leadCategoryIcon(m.lead),
                    location: m.lead.propertyLocation,
                    estimatedValueLabel:
                      estimate && estimate > 0 ? formatMoney(estimate) : null,
                    statusLabel: status.label,
                    statusTone: status.tone,
                    contact:
                      m.lead.landownerPhone
                        ? {
                            name:
                              m.lead.landownerName ||
                              [m.lead.firstName, m.lead.lastName].filter(Boolean).join(" ") ||
                              "Landowner",
                            phone: m.lead.landownerPhone,
                            email: m.lead.landownerEmail,
                          }
                        : null,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
