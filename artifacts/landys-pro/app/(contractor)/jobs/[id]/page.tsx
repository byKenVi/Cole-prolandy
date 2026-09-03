import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MapPin, Phone, Mail, CheckCircle2, Lock, Hammer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { LeadActions } from "@/components/lead-actions";
import { ExpiryCountdown } from "@/components/expiry-countdown";
import { iconSrcFor } from "@/lib/project-icons";
import { formatMoney } from "@/lib/money";
import {
  hasResolvedLeadSnapshot,
  leadCategoryIcon,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";
import { canRevealLeadContact } from "@/lib/lead-contact";

export const dynamic = "force-dynamic";

export default async function JobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const match = await prisma.leadMatch.findUnique({
    where: { id },
    include: {
      contractor: true,
      successFee: true,
      lead: { include: leadDisplayInclude },
    },
  });
  if (!match) notFound();
  if (session.role === "contractor" && match.contractorId !== session.contractorId) {
    notFound();
  }

  const { lead, successFee } = match;
  if (!hasResolvedLeadSnapshot(lead)) notFound();

  const expired =
    match.status === "EXPIRED" ||
    lead.status === "EXPIRED" ||
    lead.expiresAt.getTime() <= Date.now();
  const accepted = canRevealLeadContact(match.status);
  const declined = match.status === "DECLINED";
  const actionable = !accepted && !declined && !expired;
  const categoryName = leadCategoryLabel(lead);
  const iconSrc = iconSrcFor({
    icon: leadCategoryIcon(lead),
    category: categoryName,
    project: leadScopeLabel(lead),
  });

  const won = match.jobOutcome === "WON";
  const feeRatePercent = successFee ? successFee.rateBasisPoints / 100 : null;

  return (
    <div className="contractor-page px-4 py-6 sm:px-5 md:px-[34px] md:py-8">
      <Link
        href={accepted ? "/jobs" : "/opportunities"}
        className="mb-5 flex w-fit items-center gap-1.5 text-[14px] text-[#8A7E68] transition-colors hover:text-[#3A352D]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {accepted ? "my jobs" : "opportunities"}
      </Link>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="order-2 min-w-0 overflow-hidden rounded-[22px] border border-[#EBE3D4] bg-[#FFFDF9] shadow-[0_12px_32px_rgba(58,53,45,0.08)] lg:order-1">
          <div className="px-4 pb-6 pt-5 sm:px-5 md:px-8 md:pb-8 md:pt-7">
            <div className="mb-2 flex items-center gap-[15px]">
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-[15px] bg-[#F5EEDF]">
                {iconSrc ? (
                  <Image src={iconSrc} alt="" aria-hidden width={72} height={72} className="h-9 w-9 object-contain" />
                ) : (
                  <Hammer className="h-8 w-8 text-[#9A6E2E]" aria-hidden />
                )}
              </span>
              <div>
                <h1 className="font-fraunces text-[28px] font-medium tracking-[-0.01em] text-[#3A352D]">
                  {leadScopeLabel(lead)}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-[15px] text-[#6B6459]">
                  <MapPin className="h-4 w-4" strokeWidth={1.7} /> {lead.propertyLocation}
                </p>
              </div>
            </div>

            <div className="my-6 flex flex-wrap gap-2.5">
              <span className="rounded-full bg-[#F4EAD3] px-[13px] py-2 text-[13px] font-medium text-[#8A6B2E]">
                {categoryName}
              </span>
              {lead.landType && (
                <span className="rounded-full bg-[#F0EADD] px-[13px] py-2 text-[13px] font-medium text-[#6B6459]">
                  {lead.landType.name}
                </span>
              )}
              {actionable && <ExpiryCountdown expiresAt={lead.expiresAt} variant="prominent" />}
              {expired && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#F6E4E1] px-[13px] py-2 text-[13px] font-medium text-[#9A3B2E]">
                  Expired
                </span>
              )}
              {accepted && match.jobOutcome !== "OPEN" && (
                <span
                  className="rounded-full px-[13px] py-2 text-[13px] font-medium"
                  style={
                    match.jobOutcome === "WON"
                      ? { color: "#2F4A3C", background: "#E8F0EA" }
                      : { color: "#9A3B2E", background: "#F6E4E1" }
                  }
                >
                  {match.jobOutcome === "WON" ? "Won" : "Lost"}
                </span>
              )}
            </div>

            {lead.description && (
              <div className="mb-6 rounded-[16px] border border-[#EBE3D4] bg-[#FFFDF9] p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8A7E68]">
                  Project details
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-[#3A352D]">
                  {lead.description}
                </p>
              </div>
            )}

            {accepted ? (
              <div className="rounded-[16px] bg-[#F3ECDD] p-5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-[#8A6B2E]">
                  <CheckCircle2 className="h-4 w-4" /> Contact unlocked
                </p>
                <p className="mt-2 text-[16px] font-semibold text-[#3A352D]">
                  {lead.landownerName ?? "Name not provided"}
                </p>
                {lead.landownerPhone && (
                  <a href={`tel:${lead.landownerPhone}`} className="mt-1 flex items-center gap-2 text-[16px] text-[#3A352D]">
                    <Phone className="h-[17px] w-[17px]" strokeWidth={1.7} /> {lead.landownerPhone}
                  </a>
                )}
                <a
                  href={`mailto:${lead.landownerEmail}`}
                  className="flex items-center gap-2 text-[16px] text-[#3A352D]"
                >
                  <Mail className="h-[17px] w-[17px]" strokeWidth={1.7} /> {lead.landownerEmail}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-[14px] rounded-[16px] border border-dashed border-[#D8CEBB] bg-[#F3ECDD] px-5 py-[18px]">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#E6DECD] text-[#7A6E58]">
                  <Lock className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[#3A352D]">Landowner contact is hidden</p>
                  <p className="mt-0.5 text-[14px] text-[#6B6459]">
                    Name and phone unlock the moment you accept.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="order-1 min-w-0 rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-5 shadow-[0_12px_32px_rgba(58,53,45,0.10)] sm:p-6 lg:order-2 lg:sticky lg:top-6">
          {won && successFee ? (
            <>
              <p className="text-[13px] font-medium uppercase tracking-[0.05em] text-[#6B6459]">Success fee</p>
              <p className="mb-1 mt-0.5 text-[42px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#4A3E2D]">
                {formatMoney(successFee.feeAmountCents)}
              </p>
              <p className="mb-5 text-[14px] text-[#6B6459]">
                {feeRatePercent != null && feeRatePercent % 1 === 0
                  ? `${feeRatePercent.toFixed(0)}%`
                  : `${feeRatePercent?.toFixed(1)}%`}{" "}
                of {formatMoney(successFee.finalValueCents)} final value
              </p>
              <div
                className="rounded-[14px] px-4 py-3 text-center text-sm font-medium"
                style={
                  successFee.status === "PAID"
                    ? { background: "#E8F0EA", color: "#2F4A3C" }
                    : successFee.status === "DUE"
                      ? { background: "#F6E4E1", color: "#9A3B2E" }
                      : { background: "#F4EAD3", color: "#8A6B2E" }
                }
              >
                {successFee.status === "PAID"
                  ? "Success fee paid"
                  : successFee.status === "DUE"
                    ? "Fee due — pay from the Fees tab"
                    : "Confirm landowner payment to mark fee due"}
              </div>
            </>
          ) : accepted ? (
            <p className="flex items-center justify-center gap-2 rounded-[14px] bg-[#2F4A3C] py-4 text-[16px] font-semibold text-white">
              <CheckCircle2 className="h-5 w-5 text-[#E0A95C]" /> Accepted
            </p>
          ) : expired ? (
            <p className="rounded-[14px] bg-[#F6E4E1] p-4 text-center text-sm font-medium text-[#9A3B2E]">
              This opportunity has expired and can no longer be accepted.
            </p>
          ) : declined ? (
            <p className="rounded-[14px] bg-[#F3ECDD] p-4 text-center text-sm font-medium text-[#6B6459]">
              You passed on this opportunity.
            </p>
          ) : (
            <LeadActions matchId={match.id} />
          )}

          {actionable && (
            <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[13px] text-[#A79E8D]">
              <Lock className="h-3.5 w-3.5" /> Contact unlocks after you accept
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
