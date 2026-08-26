import { MapPin, Hammer } from "lucide-react";
import Image from "next/image";
import { FollowUpAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FollowUpTokenActions } from "@/components/follow-up-token-actions";
import { iconSrcFor } from "@/lib/project-icons";
import { hasResolvedLeadSnapshot, leadCategoryIcon, leadCategoryLabel, leadDisplayInclude, leadScopeLabel } from "@/lib/resolved-lead";

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

export default async function FollowUpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const row = await prisma.followUpToken.findUnique({
    where: { token },
    include: {
      leadMatch: {
        include: {
          contractor: { select: { name: true } },
          lead: { include: leadDisplayInclude },
        },
      },
    },
  });

  const expired = !!row && row.expiresAt.getTime() <= Date.now();
  const used = !!row?.usedAt;
  const invalid =
    !row ||
    !row.leadMatch ||
    (row.action !== FollowUpAction.REPORT_OUTCOME && row.action !== FollowUpAction.CONFIRM_PAID);

  const match =
    row?.leadMatch && hasResolvedLeadSnapshot(row.leadMatch.lead)
      ? row.leadMatch
      : null;

  const iconSrc = match
    ? iconSrcFor({
        icon: leadCategoryIcon(match.lead),
        category: leadCategoryLabel(match.lead),
        project: leadScopeLabel(match.lead),
      })
    : null;

  const title =
    row?.action === FollowUpAction.CONFIRM_PAID
      ? "Payment check-in"
      : "Job outcome check-in";

  const subtitle =
    row?.action === FollowUpAction.CONFIRM_PAID
      ? "Let us know if the landowner has paid you for this job."
      : "Quick update on how this lead turned out.";

  return (
    <main className="min-h-screen bg-[#FEFBF6] font-inter">
      <header className="px-4 pb-1 pt-5 text-center">
        <Wordmark />
        {!invalid && !used && !expired && match && (
          <p className="mt-2 text-[15px] text-[#6B6459]">{subtitle}</p>
        )}
      </header>

      {invalid ? (
        <div className="px-4 py-8">
          <Notice text="This follow-up link is not valid. It may have been mistyped or removed." />
        </div>
      ) : used ? (
        <div className="px-4 py-8">
          <Notice text="This link has already been used. Thank you!" />
        </div>
      ) : expired ? (
        <div className="px-4 py-8">
          <Notice text="This follow-up link has expired." />
        </div>
      ) : !match ? (
        <div className="px-4 py-8">
          <Notice text="This follow-up link is not valid. It may have been mistyped or removed." />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
          <div className="rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-5 shadow-[0_12px_32px_rgba(58,53,45,0.10)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#C0803C]">
              {title}
            </p>
            <div className="mb-4 mt-3 flex items-start gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-[#F5EEDF]">
                {iconSrc ? (
                  <Image src={iconSrc} alt="" aria-hidden width={40} height={40} className="h-7 w-7 object-contain" />
                ) : (
                  <Hammer className="h-6 w-6 text-[#9A6E2E]" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <h1 className="font-fraunces text-[20px] font-medium leading-tight tracking-[-0.01em] text-[#3A352D]">
                  {leadScopeLabel(match.lead)}
                </h1>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-[#6B6459]">
                  <MapPin className="h-3.5 w-3.5 flex-none" strokeWidth={1.7} />
                  <span className="truncate">{match.lead.propertyLocation}</span>
                </p>
              </div>
            </div>

            <FollowUpTokenActions
              token={token}
              action={row.action as "REPORT_OUTCOME" | "CONFIRM_PAID"}
            />
          </div>
        </div>
      )}
    </main>
  );
}
