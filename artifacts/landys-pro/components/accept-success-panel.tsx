import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone, Mail, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/money";

export type AcceptSuccessProps = {
  matchId: string;
  projectName: string;
  categoryName: string | null;
  location: string;
  iconSrc: string;
  estimatedBudgetLabel: string | null;
  feeRateLabel: string | null;
  estimatedFeeLabel: string | null;
  landownerName: string;
  landownerPhone: string | null;
  landownerEmail: string | null;
  /** When true, user already has a matching contractor session — link straight into the portal. */
  hasContractorSession: boolean;
};

export function AcceptSuccessPanel(props: AcceptSuccessProps) {
  const {
    matchId,
    projectName,
    categoryName,
    location,
    iconSrc,
    estimatedBudgetLabel,
    feeRateLabel,
    estimatedFeeLabel,
    landownerName,
    landownerPhone,
    landownerEmail,
    hasContractorSession,
  } = props;

  const jobsHref = `/jobs/${matchId}`;
  const portalHref = hasContractorSession
    ? jobsHref
    : `/sign-in?redirect_url=${encodeURIComponent(jobsHref)}`;

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-2 sm:pb-14">
      <div className="overflow-hidden rounded-[22px] border border-[#EBE3D4] bg-[#FFFDF9] shadow-[0_12px_32px_rgba(58,53,45,0.10)]">
        {/* Success banner */}
        <div className="border-b border-[#DCE8DF] bg-[#E7EDE8] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-white shadow-sm">
              <Image
                src={iconSrc}
                alt=""
                aria-hidden
                width={48}
                height={48}
                className="h-8 w-8 object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#2F6B4A]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Accepted
              </p>
              <h1 className="mt-1 font-fraunces text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[#2F4A3C] sm:text-[28px]">
                You&apos;re on this job
              </h1>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {/* Job summary */}
          <div className="min-w-0">
            <h2 className="font-fraunces text-[20px] font-semibold leading-snug text-[#3A352D]">
              {projectName}
            </h2>
            {categoryName && (
              <p className="mt-0.5 text-[13px] text-[#8A7E68]">{categoryName}</p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[15px] font-medium text-[#5A4E3E]">
              <MapPin className="h-4 w-4 flex-none text-[#B0A691]" strokeWidth={1.7} aria-hidden />
              <span>{location}</span>
            </p>
          </div>

          {(estimatedBudgetLabel || estimatedFeeLabel || feeRateLabel) && (
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {estimatedBudgetLabel && (
                <div className="rounded-[14px] border border-[#EDE4D3] bg-[#FAF4E9] px-3.5 py-3">
                  <p className="text-[13px] font-medium text-[#6B6459]">Estimated budget</p>
                  <p className="mt-1 text-[18px] font-semibold tabular-nums text-[#3A352D]">
                    {estimatedBudgetLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#A39884]">From landowner intake</p>
                </div>
              )}
              {(estimatedFeeLabel || feeRateLabel) && (
                <div className="rounded-[14px] border border-[#EDE4D3] bg-[#FAF4E9] px-3.5 py-3">
                  <p className="text-[13px] font-medium text-[#6B6459]">Landy&apos;s success fee</p>
                  <p className="mt-1 text-[18px] font-semibold tabular-nums text-[#3A352D]">
                    {estimatedFeeLabel ?? feeRateLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#A39884]">
                    {estimatedFeeLabel && feeRateLabel
                      ? `${feeRateLabel} if you win & get paid`
                      : "Only after you get paid"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Landowner contact */}
          <div className="mt-5 rounded-[16px] border border-[#E6DFD1] bg-white p-4 shadow-[0_2px_8px_rgba(58,53,45,0.04)]">
            <p className="text-[14px] font-medium text-[#8A6B2E]">Landowner contact</p>
            <p className="mt-2 text-[18px] font-semibold text-[#3A352D]">{landownerName}</p>

            <div className="mt-4 flex flex-col gap-2.5">
              {landownerPhone ? (
                <a
                  href={`tel:${landownerPhone}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[#C0803C] px-4 text-[16px] font-semibold text-white"
                >
                  <Phone className="h-5 w-5" strokeWidth={2} aria-hidden />
                  Call {landownerPhone}
                </a>
              ) : (
                <p className="rounded-[12px] bg-[#F5EEDF] px-4 py-3 text-[14px] text-[#8A7E68]">
                  No phone on file — use email below.
                </p>
              )}
              {landownerEmail ? (
                <a
                  href={`mailto:${landownerEmail}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-[#E6DFD1] bg-[#FDFAF4] px-4 text-[16px] font-semibold text-[#4A3E2D]"
                >
                  <Mail className="h-5 w-5 text-[#C0803C]" strokeWidth={2} aria-hidden />
                  Email {landownerEmail}
                </a>
              ) : null}
            </div>
          </div>

          {/* What happens next */}
          <div className="mt-6">
            <h3 className="font-fraunces text-[18px] font-semibold text-[#3A352D]">
              What happens next?
            </h3>
            <ol className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-[#5A4E3E]">
              <li className="flex gap-2.5">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#F4EAD3] text-[12px] font-bold text-[#8A6B2E]">
                  1
                </span>
                <span>Contact the landowner using the Call or Email buttons above.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#F4EAD3] text-[12px] font-bold text-[#8A6B2E]">
                  2
                </span>
                <span>Discuss and complete the work directly with them — off Landy&apos;s platform.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#F4EAD3] text-[12px] font-bold text-[#8A6B2E]">
                  3
                </span>
                <span>Landy&apos;s will text/email to ask whether you got the job.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#F4EAD3] text-[12px] font-bold text-[#8A6B2E]">
                  4
                </span>
                <span>Later, we&apos;ll ask whether you&apos;ve been paid.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#F4EAD3] text-[12px] font-bold text-[#8A6B2E]">
                  5
                </span>
                <span>You only owe Landy&apos;s the success fee after you&apos;ve been paid.</span>
              </li>
            </ol>
          </div>

          <div className="mt-6">
            <Link
              href={portalHref}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[12px] border border-[#C0803C] bg-white px-4 text-[16px] font-semibold text-[#C0803C]"
            >
              {hasContractorSession ? "Go to My Jobs" : "Open Contractor Portal"}
            </Link>
            {!hasContractorSession && (
              <p className="mt-2 text-center text-[12px] leading-snug text-[#8A7E68]">
                Sign in with your contractor account to see all jobs and fees. This link only unlocked
                this one opportunity.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Helper for fee rate label formatting. */
export function formatFeeRateLabel(rateBasisPoints: number): string {
  const pct = rateBasisPoints / 100;
  return pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

export function formatBudgetCents(cents: number | null | undefined): string | null {
  if (cents == null || cents <= 0) return null;
  return formatMoney(cents);
}
