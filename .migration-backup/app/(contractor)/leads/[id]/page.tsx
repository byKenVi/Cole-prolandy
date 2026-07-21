import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MapPin, Phone, Mail, CheckCircle2, Lock, Hammer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LeadActions } from "@/components/lead-actions";
import { iconSrcFor } from "@/lib/project-icons";
import { tierPill } from "@/lib/tier-style";
import { formatMoney } from "@/lib/money";
import { timeUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const match = await prisma.leadMatch.findUnique({
    where: { id },
    include: {
      contractor: true,
      lead: {
        include: { projectType: { include: { contractorType: true } }, landType: true },
      },
    },
  });
  if (!match) notFound();
  if (session.role === "contractor" && match.contractorId !== session.contractorId) {
    notFound();
  }

  const { lead, contractor } = match;
  const expired =
    match.status === "EXPIRED" ||
    lead.status === "EXPIRED" ||
    lead.expiresAt.getTime() <= Date.now();
  const accepted = match.status === "ACCEPTED";
  const declined = match.status === "DECLINED";
  const actionable = !accepted && !declined && !expired;
  const insufficient = contractor.walletBalanceCents < lead.priceCents;
  const categoryName = lead.projectType.contractorType.name;
  const pill = tierPill(lead.tier);
  const iconSrc = iconSrcFor({
    icon: lead.projectType.contractorType.icon,
    category: categoryName,
    project: lead.projectType.name,
  });

  return (
    <div className="px-5 py-6 md:px-[34px] md:py-8">
      <Link
        href="/home"
        className="mb-5 flex w-fit items-center gap-1.5 text-[14px] text-[#8A7E68] transition-colors hover:text-[#3A352D]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT — lead card */}
        <div className="overflow-hidden rounded-[22px] border border-[#EBE3D4] bg-[#FFFDF9] shadow-[0_12px_32px_rgba(58,53,45,0.08)]">
          {/* map / property preview */}
          <div
            className="flex h-[200px] items-center justify-center"
            style={{
              background:
                "repeating-linear-gradient(135deg,#E9E1D2,#E9E1D2 11px,#E2D9C7 11px,#E2D9C7 22px)",
            }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DFD1] bg-[#FDFBF7] px-3 py-1.5 text-[13px] font-medium text-[#5A4E3E]">
              <MapPin className="h-4 w-4 text-[#C0803C]" /> {lead.propertyLocation}
            </span>
          </div>

          <div className="px-8 pb-8 pt-7">
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
                  {lead.projectType.name}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-[15px] text-[#6B6459]">
                  <MapPin className="h-4 w-4" strokeWidth={1.7} /> {lead.propertyLocation}
                </p>
              </div>
            </div>

            <div className="my-6 flex flex-wrap gap-2.5">
              <span
                className="rounded-full px-[13px] py-2 text-[13px] font-medium"
                style={{ color: pill.color, background: pill.background }}
              >
                {pill.label}
              </span>
              {lead.landType && (
                <span className="rounded-full bg-[#F0EADD] px-[13px] py-2 text-[13px] font-medium text-[#6B6459]">
                  {lead.landType.name}
                </span>
              )}
              {actionable && (
                <span className="rounded-full bg-[#F0EADD] px-[13px] py-2 text-[13px] font-medium text-[#6B6459]">
                  {timeUntil(lead.expiresAt)}
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
                <p className="mt-2 text-[16px] font-semibold text-[#3A352D]">{lead.landownerName}</p>
                <a href={`tel:${lead.landownerPhone}`} className="mt-1 flex items-center gap-2 text-[16px] text-[#3A352D]">
                  <Phone className="h-[17px] w-[17px]" strokeWidth={1.7} /> {lead.landownerPhone}
                </a>
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

        {/* RIGHT — price + actions */}
        <div className="rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-6 shadow-[0_12px_32px_rgba(58,53,45,0.10)] lg:sticky lg:top-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.05em] text-[#6B6459]">Lead price</p>
          <p className="mb-5 mt-0.5 text-[42px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#3A352D]">
            {formatMoney(lead.priceCents)}
          </p>

          <div className="mb-5 flex items-center justify-between border-y border-[#EBE3D4] py-[14px]">
            <span className="text-[15px] text-[#6B6459]">Your balance</span>
            <span className="text-[17px] font-semibold tabular-nums text-[#3A352D]">
              {formatMoney(contractor.walletBalanceCents)}
            </span>
          </div>

          {accepted ? (
            <p className="flex items-center justify-center gap-2 rounded-[14px] bg-[#2F4A3C] py-4 text-[16px] font-semibold text-white">
              <CheckCircle2 className="h-5 w-5 text-[#E0A95C]" /> Accepted &amp; paid
            </p>
          ) : expired ? (
            <p className="rounded-[14px] bg-[#F6E4E1] p-4 text-center text-sm font-medium text-[#9A3B2E]">
              This lead has expired and can no longer be accepted.
            </p>
          ) : declined ? (
            <p className="rounded-[14px] bg-[#F3ECDD] p-4 text-center text-sm font-medium text-[#6B6459]">
              You passed on this lead.
            </p>
          ) : insufficient ? (
            <div className="flex flex-col gap-2">
              <Button asChild variant="accent" size="cta">
                <Link href="/wallet">Add funds to accept</Link>
              </Button>
              <p className="text-center text-xs text-[#8A7E68]">
                You need {formatMoney(lead.priceCents - contractor.walletBalanceCents)} more to accept.
              </p>
            </div>
          ) : (
            <LeadActions matchId={match.id} priceCents={lead.priceCents} />
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
