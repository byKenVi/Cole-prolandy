import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { FeePayButton } from "@/components/fee-pay-button";
import { leadDisplayInclude, leadScopeLabel } from "@/lib/resolved-lead";

export const dynamic = "force-dynamic";

type FeeStatus = "DUE" | "PAID" | "AWAITING_CONTRACTOR_PAYMENT" | string;

function statusMeta(status: FeeStatus): {
  label: string;
  hint: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case "DUE":
      return {
        label: "Due",
        hint: "Pay Landy's now",
        color: "#9A3B2E",
        bg: "#F6E4E1",
      };
    case "PAID":
      return {
        label: "Paid",
        hint: "Settled with Landy's",
        color: "#2F4A3C",
        bg: "#E8F0EA",
      };
    case "AWAITING_CONTRACTOR_PAYMENT":
      return {
        label: "Waiting to be paid",
        hint: "You won. We'll check in when the landowner pays you.",
        color: "#8A6B2E",
        bg: "#F4EAD3",
      };
    default:
      return { label: status, hint: "", color: "#6B6459", bg: "#F0EADD" };
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

  const [fees, contractor] = await Promise.all([
    prisma.successFee.findMany({
      where: { leadMatch: { contractorId: session.contractorId } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        leadMatch: {
          include: { lead: { include: leadDisplayInclude } },
        },
      },
    }),
    prisma.contractor.findUnique({
      where: { id: session.contractorId },
      select: { cardBrand: true, cardLast4: true, stripeDefaultPaymentMethodId: true },
    }),
  ]);
  const savedCard = contractor?.stripeDefaultPaymentMethodId
    ? { brand: contractor.cardBrand, last4: contractor.cardLast4 }
    : null;

  const due = fees.filter((f) => f.status === "DUE");
  const awaiting = fees.filter((f) => f.status === "AWAITING_CONTRACTOR_PAYMENT");
  const paidFees = fees.filter((f) => f.status === "PAID");
  const other = fees.filter(
    (f) =>
      f.status !== "DUE" &&
      f.status !== "AWAITING_CONTRACTOR_PAYMENT" &&
      f.status !== "PAID",
  );

  return (
    <div className="contractor-page flex min-h-full flex-col">
      <header className="relative overflow-hidden border-b border-[#EDE4D3] px-4 pb-5 pt-5 sm:px-5 md:px-[34px] md:pt-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(224,169,92,0.12),transparent_55%),linear-gradient(180deg,#FFF9EF_0%,#FEFBF6_75%)]"
        />
        <div className="relative flex items-start gap-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-white shadow-[0_2px_10px_rgba(58,53,45,0.08)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/nav-icons/nav-wallet.png" alt="" width={40} height={40} className="h-8 w-8 object-contain" />
          </span>
          <div className="min-w-0">
            <h1 className="font-fraunces text-[28px] font-semibold tracking-[-0.01em] text-[#4A3E2D] sm:text-[32px]">
              Fees &amp; payments
            </h1>
            <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-[#6B6459]">
              <span className="font-semibold text-[#4A3E2D]">Landowners pay you directly.</span>{" "}
              Landy&apos;s only collects a success fee after you confirm you&apos;ve been paid — never for
              reviewing opportunities.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-8 px-4 py-6 sm:px-5 md:px-[34px]">
        {paid && (
          <div className="flex items-center gap-2 rounded-[14px] bg-[#E8F0EA] px-4 py-3.5 text-[15px] font-medium text-[#2F4A3C]">
            <CheckCircle2 className="h-5 w-5 flex-none" aria-hidden />
            Payment received — thank you.
          </div>
        )}

        {fees.length === 0 ? (
          <div className="contractor-card flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
            <p className="mb-2 font-fraunces text-[22px] font-medium text-[#4A3E2D]">
              No success fees yet
            </p>
            <p className="max-w-[40ch] text-[15px] leading-relaxed text-[#6B6459]">
              When you win a job and confirm the landowner paid you, Landy&apos;s fee appears here.
            </p>
            <Link href="/jobs" className="contractor-action-secondary mt-6">
              View my jobs
            </Link>
          </div>
        ) : (
          <>
            {due.length > 0 && (
              <section>
                <h2 className="font-fraunces text-[20px] font-semibold text-[#9A3B2E]">Due now</h2>
                <p className="mt-0.5 text-[13px] text-[#8A7E68]">
                  Landowner paid you · Landy&apos;s fee is ready
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  {due.map((fee) => (
                    <FeeCard key={fee.id} fee={fee} emphasize savedCard={savedCard} />
                  ))}
                </div>
              </section>
            )}

            {awaiting.length > 0 && (
              <FeeSection title="Waiting to be paid" fees={awaiting} savedCard={savedCard} />
            )}
            {paidFees.length > 0 && <FeeSection title="Paid" fees={paidFees} savedCard={savedCard} />}
            {other.length > 0 && <FeeSection title="Other" fees={other} savedCard={savedCard} />}
          </>
        )}
      </div>
    </div>
  );
}

function FeeSection({
  title,
  fees,
  savedCard,
}: {
  title: string;
  fees: Array<{
    id: string;
    status: string;
    feeAmountCents: number;
    finalValueCents: number;
    rateBasisPoints: number;
    leadMatchId: string;
    paymentMethod: string | null;
    leadMatch: { lead: Parameters<typeof leadScopeLabel>[0] & { propertyLocation: string } };
  }>;
  savedCard?: { brand?: string | null; last4?: string | null } | null;
}) {
  return (
    <section>
      <h2 className="font-fraunces text-[20px] font-semibold text-[#4A3E2D]">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {fees.map((fee) => (
          <FeeCard key={fee.id} fee={fee} savedCard={savedCard} />
        ))}
      </div>
    </section>
  );
}

function FeeCard({
  fee,
  emphasize = false,
  savedCard,
}: {
  fee: {
    id: string;
    status: string;
    feeAmountCents: number;
    finalValueCents: number;
    rateBasisPoints: number;
    leadMatchId: string;
    paymentMethod?: string | null;
    leadMatch: { lead: Parameters<typeof leadScopeLabel>[0] & { propertyLocation: string } };
  };
  emphasize?: boolean;
  savedCard?: { brand?: string | null; last4?: string | null } | null;
}) {
  const status = statusMeta(fee.status);
  const ratePercent = fee.rateBasisPoints / 100;
  const rateLabel =
    ratePercent % 1 === 0 ? `${ratePercent.toFixed(0)}%` : `${ratePercent.toFixed(1)}%`;
  const method =
    fee.status === "PAID"
      ? fee.paymentMethod === "stripe"
        ? "Paid via card"
        : fee.paymentMethod
          ? `Paid · ${fee.paymentMethod}`
          : "Paid"
      : null;

  return (
    <article
      className={`group relative rounded-[18px] border p-4 sm:p-5 hover:bg-[#FBF6EC] ${
        emphasize
          ? "border-[#E8C4BE] bg-[#FDF5F3]"
          : "border-[#EBE3D4] bg-white shadow-[0_2px_8px_rgba(58,53,45,0.05)]"
      }`}
    >
      <Link
        href={`/fees/${fee.leadMatchId}`}
        className="absolute inset-0 z-0 rounded-[18px]"
        aria-label={`View fee for ${leadScopeLabel(fee.leadMatch.lead)}`}
      />
      <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="pointer-events-none min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-[#4A3E2D] group-hover:text-[#C0803C]">
            {leadScopeLabel(fee.leadMatch.lead)}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[#8A7E68]">
            {fee.leadMatch.lead.propertyLocation}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: status.color, background: status.bg }}
            >
              {status.label}
            </span>
            <span className="text-[13px] text-[#8A7E68]">
              {rateLabel} of {formatMoney(fee.finalValueCents)} contract
            </span>
            {method && <span className="text-[13px] font-medium text-[#2F4A3C]">{method}</span>}
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-stretch gap-3 sm:min-w-[200px] sm:items-end">
          <div className="pointer-events-none text-left sm:text-right">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A7E68]">
              Landy&apos;s fee
            </p>
            <p className="font-fraunces text-[28px] font-semibold tabular-nums text-[#4A3E2D]">
              {formatMoney(fee.feeAmountCents)}
            </p>
          </div>
          {fee.status === "DUE" && (
            <div className="w-full sm:w-auto [&_button]:h-12 [&_button]:w-full [&_button]:min-w-[180px] [&_button]:text-[16px]">
              <FeePayButton
                leadMatchId={fee.leadMatchId}
                amountLabel={formatMoney(fee.feeAmountCents)}
                savedCard={savedCard}
              />
            </div>
          )}
          {fee.status !== "DUE" && (
            <ChevronRight
              className="mt-1 h-4 w-4 flex-none self-end text-[#B0A691] group-hover:text-[#C0803C]"
              aria-hidden
            />
          )}
        </div>
      </div>
    </article>
  );
}
