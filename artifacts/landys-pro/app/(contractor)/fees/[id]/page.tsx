import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { FeePayButton } from "@/components/fee-pay-button";
import { leadDisplayInclude, leadScopeLabel } from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

export default async function ContractorFeeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session.contractorId) notFound();

  const fee = await prisma.successFee.findUnique({
    where: { leadMatchId: id },
    include: {
      leadMatch: {
        include: {
          contractor: {
            select: { cardBrand: true, cardLast4: true, stripeDefaultPaymentMethodId: true },
          },
          lead: { include: leadDisplayInclude },
        },
      },
    },
  });
  if (!fee || fee.leadMatch.contractorId !== session.contractorId) notFound();

  const ratePercent = fee.rateBasisPoints / 100;
  const rateLabel = ratePercent % 1 === 0 ? `${ratePercent.toFixed(0)}%` : `${ratePercent.toFixed(1)}%`;
  const savedCard = fee.leadMatch.contractor.stripeDefaultPaymentMethodId
    ? { brand: fee.leadMatch.contractor.cardBrand, last4: fee.leadMatch.contractor.cardLast4 }
    : null;

  const statusLabel =
    fee.status === "DUE"
      ? "Due — pay Landy's"
      : fee.status === "PAID"
        ? "Paid"
        : "Waiting to be paid";

  return (
    <div className="contractor-page px-4 py-6 sm:px-5 md:px-[34px] md:py-8">
      <Link
        href="/fees"
        className="mb-5 flex w-fit items-center gap-1.5 text-[14px] text-[#8A7E68] hover:text-[#3A352D]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to fees
      </Link>

      <div className="max-w-2xl rounded-[22px] border border-[#EBE3D4] bg-white p-6 shadow-[0_12px_32px_rgba(58,53,45,0.08)] sm:p-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#C0803C]">
          Landy&apos;s success fee
        </p>
        <h1 className="mt-2 font-fraunces text-[28px] font-semibold text-[#4A3E2D]">
          {leadScopeLabel(fee.leadMatch.lead)}
        </h1>
        <p className="mt-1 text-[15px] text-[#8A7E68]">{fee.leadMatch.lead.propertyLocation}</p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A7E68]">
              Final contract value
            </dt>
            <dd className="mt-1 text-[18px] font-semibold text-[#4A3E2D]">
              {formatMoney(fee.finalValueCents)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A7E68]">Rate</dt>
            <dd className="mt-1 text-[18px] font-semibold text-[#4A3E2D]">{rateLabel}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A7E68]">
              Landy&apos;s fee
            </dt>
            <dd className="mt-1 font-fraunces text-[32px] font-semibold text-[#4A3E2D]">
              {formatMoney(fee.feeAmountCents)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A7E68]">Status</dt>
            <dd className="mt-1 text-[16px] font-semibold text-[#4A3E2D]">{statusLabel}</dd>
          </div>
        </dl>

        {fee.status === "PAID" && (
          <p className="mt-5 text-[14px] text-[#2F4A3C]">
            Settled {fee.paidAt ? formatDate(fee.paidAt) : ""} via{" "}
            {fee.paymentMethod === "stripe" ? "card" : fee.paymentMethod ?? "offline"}.
          </p>
        )}

        {fee.status === "DUE" && (
          <div className="mt-6">
            <FeePayButton
              leadMatchId={fee.leadMatchId}
              amountLabel={formatMoney(fee.feeAmountCents)}
              savedCard={savedCard}
            />
            <p className="mt-3 text-[13px] text-[#8A7E68]">
              First payment can keep this card on file for later Landy&apos;s fees.
            </p>
          </div>
        )}

        <Link href={`/jobs/${fee.leadMatchId}`} className="mt-6 inline-block text-[14px] font-semibold text-[#C0803C]">
          View job
        </Link>
      </div>
    </div>
  );
}
