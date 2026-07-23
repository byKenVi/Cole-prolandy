import Image from "next/image";
import { MapPin, Phone, Mail, CheckCircle2, Lock, Hammer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AcceptTokenActions } from "@/components/accept-token-actions";
import { iconSrcFor } from "@/lib/project-icons";
import { tierPill } from "@/lib/tier-style";
import { formatMoney } from "@/lib/money";
import { timeUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

function Wordmark() {
  return (
    <div className="inline-flex items-baseline gap-2.5">
      <span className="font-vibes text-[32px] leading-none text-[#5C5142]">Landys</span>
      <span className="rounded-full border border-[#C0803C] px-[7px] py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-[#C0803C]">
        Pro
      </span>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-6 text-center text-[16px] text-[#5A5449] shadow-[0_12px_32px_rgba(58,53,45,0.08)]">
      {text}
    </div>
  );
}

export default async function AcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const match = await prisma.leadMatch.findUnique({
    where: { acceptToken: token },
    include: {
      contractor: { select: { name: true, walletBalanceCents: true } },
      lead: {
        include: { projectType: { include: { contractorType: true } }, landType: true },
      },
    },
  });

  const expired =
    !!match &&
    (match.status === "EXPIRED" ||
      match.lead.status === "EXPIRED" ||
      match.lead.expiresAt.getTime() <= Date.now());
  const pending = !!match && match.status !== "ACCEPTED" && match.status !== "DECLINED" && !expired;

  const iconSrc = match
    ? iconSrcFor({
        icon: match.lead.projectType.contractorType.icon,
        category: match.lead.projectType.contractorType.name,
        project: match.lead.projectType.name,
      })
    : null;
  const pill = match ? tierPill(match.lead.tier) : null;

  return (
    <main className="min-h-screen bg-[#FEFBF6] font-inter">
      <header className="px-4 pb-1 pt-5 text-center">
        <Wordmark />
        {pending && (
          <p className="mt-2 text-[15px] text-[#6B6459]">You&apos;ve got a new lead near you.</p>
        )}
      </header>

      {!match ? (
        <div className="px-4 py-8">
          <Notice text="This lead link is not valid. It may have been mistyped or removed." />
        </div>
      ) : match.status === "ACCEPTED" ? (
        <div className="px-4 py-8">
          <div className="mx-auto flex w-full max-w-md flex-col rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-6 shadow-[0_12px_32px_rgba(58,53,45,0.08)]">
            <p className="flex items-center gap-2 font-semibold text-[#2F6B4A]">
              <CheckCircle2 className="h-5 w-5" /> You&apos;re on this job
            </p>
            <p className="mt-3 text-sm text-[#8A7E68]">Landowner contact</p>
            <p className="text-[18px] font-semibold text-[#3A352D]">{match.lead.landownerName}</p>
            <a href={`tel:${match.lead.landownerPhone}`} className="mt-1 flex items-center gap-2 text-[16px] text-[#3A352D]">
              <Phone className="h-5 w-5 text-[#C0803C]" /> {match.lead.landownerPhone}
            </a>
            <a
              href={`mailto:${match.lead.landownerEmail}`}
              className="flex items-center gap-2 text-[16px] text-[#3A352D]"
            >
              <Mail className="h-5 w-5 text-[#C0803C]" /> {match.lead.landownerEmail}
            </a>
          </div>
        </div>
      ) : match.status === "DECLINED" ? (
        <div className="px-4 py-8">
          <Notice text="You passed on this lead. No charge was made." />
        </div>
      ) : expired ? (
        <div className="px-4 py-8">
          <Notice text="This lead has expired and can no longer be accepted." />
        </div>
      ) : (
        /* Above-the-fold Accept: price + CTA first on mobile; details below. */
        <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
          <div className="rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-5 shadow-[0_12px_32px_rgba(58,53,45,0.10)]">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-[#F5EEDF]">
                {iconSrc ? (
                  <Image src={iconSrc} alt="" aria-hidden width={40} height={40} className="h-7 w-7 object-contain" />
                ) : (
                  <Hammer className="h-6 w-6 text-[#9A6E2E]" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <h1 className="font-fraunces text-[20px] font-medium leading-tight tracking-[-0.01em] text-[#3A352D]">
                  {match.lead.projectType.name}
                </h1>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-[#6B6459]">
                  <MapPin className="h-3.5 w-3.5 flex-none" strokeWidth={1.7} />
                  <span className="truncate">{match.lead.propertyLocation}</span>
                </p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                style={pill ? { color: pill.color, background: pill.background } : undefined}
              >
                {pill?.label}
              </span>
              {match.lead.landType && (
                <span className="rounded-full bg-[#F0EADD] px-2.5 py-1 text-[12px] font-medium text-[#6B6459]">
                  {match.lead.landType.name}
                </span>
              )}
              <span className="rounded-full bg-[#F0EADD] px-2.5 py-1 text-[12px] font-medium text-[#6B6459]">
                {timeUntil(match.lead.expiresAt)}
              </span>
            </div>

            <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#6B6459]">Lead price</p>
            <p className="mt-0.5 text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#3A352D]">
              {formatMoney(match.lead.priceCents)}
            </p>
            <div className="mb-4 mt-3 flex items-center justify-between border-y border-[#EBE3D4] py-3">
              <span className="text-[14px] text-[#6B6459]">Your balance</span>
              <span className="text-[16px] font-semibold tabular-nums text-[#3A352D]">
                {formatMoney(match.contractor.walletBalanceCents)}
              </span>
            </div>

            <AcceptTokenActions token={token} priceCents={match.lead.priceCents} />

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[#A79E8D]">
              <Lock className="h-3.5 w-3.5" /> Contact unlocks after you accept
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
