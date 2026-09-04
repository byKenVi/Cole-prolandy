import { MapPin } from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getAcceptedMatchesForLandowner } from "@/lib/domain/landowner-confirm";
import { LandownerConfirmActions } from "@/components/landowner-confirm-actions";
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

export default async function LandownerFollowUpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const confirmation = await prisma.landownerConfirmation.findUnique({
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
    confirmation && !confirmation.respondedAt
      ? await getAcceptedMatchesForLandowner(confirmation.leadId)
      : [];

  const contractors = acceptedMatches.map((m) => ({
    leadMatchId: m.id,
    contractorName: m.contractor.name,
  }));

  const iconSrc = lead
    ? iconSrcFor({
        icon: leadCategoryIcon(lead),
        category: leadCategoryLabel(lead),
        project: leadScopeLabel(lead),
      })
    : null;

  return (
    <main className="min-h-screen bg-[#FEFBF6] font-inter">
      <header className="px-4 pb-1 pt-5 text-center">
        <Wordmark />
        {confirmation && !confirmation.respondedAt && lead && (
          <p className="mt-2 text-[15px] text-[#6B6459]">
            One quick question about your project.
          </p>
        )}
      </header>

      {!confirmation || !lead ? (
        <div className="px-4 py-8">
          <Notice text="This confirmation link is not valid. It may have been mistyped or removed." />
        </div>
      ) : confirmation.respondedAt ? (
        <div className="px-4 py-8">
          <Notice text="We already received your response. Thank you!" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
          <div className="rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-5 shadow-[0_12px_32px_rgba(58,53,45,0.10)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#C0803C]">
              Payment check-in
            </p>
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
                  {leadScopeLabel(lead)}
                </h1>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-[#6B6459]">
                  <MapPin className="h-3.5 w-3.5 flex-none" strokeWidth={1.7} />
                  <span className="truncate">{lead.propertyLocation}</span>
                </p>
              </div>
            </div>

            <Suspense fallback={<p className="text-center text-[14px] text-[#8A7E68]">Loading…</p>}>
              <LandownerConfirmActions token={token} contractors={contractors} />
            </Suspense>
          </div>
        </div>
      )}
    </main>
  );
}
