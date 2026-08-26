import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { FeePayButton } from "@/components/fee-pay-button";
import { leadDisplayInclude, leadScopeLabel } from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

function feeStatusDisplay(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "DUE":
      return { label: "Due", color: "#9A3B2E", bg: "#F6E4E1" };
    case "PAID":
      return { label: "Paid", color: "#2F4A3C", bg: "#E8F0EA" };
    case "AWAITING_CONTRACTOR_PAYMENT":
      return { label: "Awaiting your payment from landowner", color: "#8A6B2E", bg: "#F4EAD3" };
    default:
      return { label: status, color: "#6B6459", bg: "#F0EADD" };
  }
}

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const session = await getSession();
  const { paid } = await searchParams;

  if (!session.contractorId) {
    return (
      <div className="contractor-page px-4 py-10 sm:px-5 md:px-[34px]">
        <p className="text-[15px] text-[#6B6459]">Sign in to view your success fees.</p>
      </div>
    );
  }

  const fees = await prisma.successFee.findMany({
    where: { leadMatch: { contractorId: session.contractorId } },
    orderBy: { createdAt: "desc" },
    include: {
      leadMatch: {
        include: { lead: { include: leadDisplayInclude } },
      },
    },
  });

  return (
    <div className="contractor-page flex min-h-full flex-col">
      <header className="border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:px-[34px] md:pt-[26px]">
        <h1 className="font-fraunces text-[26px] font-semibold tracking-[-0.01em] text-[#3A352D] sm:text-[30px]">
          Fees &amp; payments
        </h1>
        <p className="mt-[5px] text-[14px] leading-relaxed text-[#8A7E68]">
          Your success fees to Landy&apos;s — separate from what the landowner pays you directly.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-5 md:px-[34px]">
        {paid && (
          <div className="flex items-center gap-2 rounded-[14px] bg-[#E8F0EA] px-4 py-3 text-[14px] font-medium text-[#2F4A3C]">
            <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden />
            Payment received — thank you.
          </div>
        )}

        {fees.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[18px] border border-[#EBE3D4] bg-white px-10 py-16 text-center shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
            <p className="mb-2 font-fraunces text-[22px] font-medium text-[#3A352D]">No success fees yet</p>
            <p className="max-w-[44ch] text-[15px] leading-[1.6] text-[#6B6459]">
              When you win a job and confirm you&apos;ve been paid, your success fee will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
            {fees.map((fee) => {
              const lead = fee.leadMatch.lead;
              const status = feeStatusDisplay(fee.status);
              const ratePercent = fee.rateBasisPoints / 100;
              const rateLabel =
                ratePercent % 1 === 0 ? `${ratePercent.toFixed(0)}%` : `${ratePercent.toFixed(1)}%`;

              return (
                <div
                  key={fee.id}
                  className="flex flex-col gap-4 border-b border-[#F2EBDD] px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/jobs/${fee.leadMatchId}`}
                      className="truncate text-[16px] font-semibold text-[#3A352D] hover:text-[#C0803C]"
                    >
                      {leadScopeLabel(lead)}
                    </Link>
                    <p className="mt-0.5 truncate text-[13px] text-[#8A7E68]">{lead.propertyLocation}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-[10px] py-1 text-[11px] font-semibold"
                        style={{ color: status.color, background: status.bg }}
                      >
                        {status.label}
                      </span>
                      <span className="text-[13px] text-[#8A7E68]">
                        {rateLabel} of {formatMoney(fee.finalValueCents)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-none items-center gap-3">
                    <p className="text-[22px] font-semibold tabular-nums text-[#4A3E2D]">
                      {formatMoney(fee.feeAmountCents)}
                    </p>
                    {fee.status === "DUE" && (
                      <FeePayButton
                        leadMatchId={fee.leadMatchId}
                        amountLabel={formatMoney(fee.feeAmountCents)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
