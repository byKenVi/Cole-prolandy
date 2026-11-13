import { MapPin } from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import {
  getAcceptedMatchesForLandowner,
  submitLandownerConfirmation,
} from "@/lib/domain/landowner-confirm";
import { LandownerConfirmActions } from "@/components/landowner-confirm-actions";
import { iconSrcFor } from "@/lib/project-icons";
import {
  hasResolvedLeadSnapshot,
  leadCategoryIcon,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";
import { DomainError } from "@/lib/domain/errors";

export const dynamic = "force-dynamic";

function Wordmark() {
  return (
    <div className="inline-flex items-baseline gap-2.5">
      <span className="font-vibes text-[32px] leading-none text-[#5C5142]">Landys</span>
      <span className="brand-pro">Pro</span>
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

export default async function LandownerFollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { token } = await params;
  const { a: answer } = await searchParams;

  let confirmation = await prisma.landownerConfirmation.findUnique({
    where: { token },
    include: {
      lead: { include: leadDisplayInclude },
    },
  });

  const lead =
    confirmation?.lead && hasResolvedLeadSnapshot(confirmation.lead)
      ? confirmation.lead
      : null;

  const acceptedMatches =
    confirmation && lead
      ? await getAcceptedMatchesForLandowner(confirmation.leadId)
      : [];

  const contractors = acceptedMatches.map((m) => ({
    leadMatchId: m.id,
    contractorName: m.contractor.name,
  }));

  // Email deep links: process server-side so thank-you works without client JS.
  let deepLinkError: string | null = null;
  let needsContractorPick = false;
  if (confirmation && lead && !confirmation.respondedAt && (answer === "paid" || answer === "notyet")) {
    try {
      if (answer === "notyet") {
        await submitLandownerConfirmation({ token, hired: false });
        confirmation = await prisma.landownerConfirmation.findUnique({
          where: { token },
          include: { lead: { include: leadDisplayInclude } },
        });
      } else if (contractors.length === 1) {
        await submitLandownerConfirmation({
          token,
          hired: true,
          hiredLeadMatchId: contractors[0]!.leadMatchId,
        });
        confirmation = await prisma.landownerConfirmation.findUnique({
          where: { token },
          include: { lead: { include: leadDisplayInclude } },
        });
      } else if (contractors.length > 1) {
        needsContractorPick = true;
      } else {
        deepLinkError = "No contractors are linked to this project yet.";
      }
    } catch (e) {
      if (e instanceof DomainError && e.message.includes("already submitted")) {
        confirmation = await prisma.landownerConfirmation.findUnique({
          where: { token },
          include: { lead: { include: leadDisplayInclude } },
        });
      } else {
        deepLinkError = e instanceof DomainError ? e.message : "Something went wrong.";
      }
    }
  }

  const leadFresh =
    confirmation?.lead && hasResolvedLeadSnapshot(confirmation.lead)
      ? confirmation.lead
      : lead;

  const iconSrc = leadFresh
    ? iconSrcFor({
        icon: leadCategoryIcon(leadFresh),
        category: leadCategoryLabel(leadFresh),
        project: leadScopeLabel(leadFresh),
      })
    : null;

  const thankYou =
    !!confirmation?.respondedAt &&
    (answer === "paid" || answer === "notyet" || !needsContractorPick);

  return (
    <main className="min-h-screen bg-[#FEFBF6] font-inter">
      <header className="px-4 pb-1 pt-5 text-center">
        <Wordmark />
        {confirmation && !confirmation.respondedAt && leadFresh && (
          <p className="mt-2 text-[15px] text-[#6B6459]">
            One quick question about your project.
          </p>
        )}
      </header>

      {!confirmation || !leadFresh ? (
        <div className="px-4 py-8">
          <Notice text="This confirmation link is not valid. It may have been mistyped or removed." />
        </div>
      ) : confirmation.respondedAt && !needsContractorPick ? (
        <div className="px-4 py-8">
          <Notice
            text={
              thankYou
                ? "Thank you — we recorded your answer."
                : "We already received your response. Thank you!"
            }
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
          <div className="rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-5 shadow-[0_12px_32px_rgba(58,53,45,0.10)]">
            <p className="text-[14px] font-medium text-[#8A6B2E]">Payment check-in</p>
            <div className="mb-4 mt-3 flex items-start gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-[#F5EEDF]">
                <Image
                  src={iconSrc ?? "/icons/fallback.png"}
                  alt=""
                  aria-hidden
                  width={40}
                  height={40}
                  className="h-7 w-7 object-contain"
                />
              </span>
              <div className="min-w-0">
                <h1 className="font-fraunces text-[20px] font-medium leading-tight tracking-[-0.01em] text-[#3A352D]">
                  {leadScopeLabel(leadFresh)}
                </h1>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-[#6B6459]">
                  <MapPin className="h-3.5 w-3.5 flex-none" strokeWidth={1.7} />
                  <span className="truncate">{leadFresh.propertyLocation}</span>
                </p>
              </div>
            </div>

            {deepLinkError && (
              <p className="mb-3 rounded-[12px] bg-[#F6E4E1] px-3 py-2.5 text-[14px] font-medium text-[#9A3B2E]">
                {deepLinkError}
              </p>
            )}

            <Suspense fallback={<p className="text-center text-[14px] text-[#8A7E68]">Loading…</p>}>
              <LandownerConfirmActions
                token={token}
                contractors={contractors}
                initialStep={needsContractorPick ? "pick" : "choice"}
              />
            </Suspense>
          </div>
        </div>
      )}
    </main>
  );
}
