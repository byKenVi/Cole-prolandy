import Image from "next/image";
import Link from "next/link";
import { MapPin, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession, authMode } from "@/lib/auth";
import { AcceptTokenActions } from "@/components/accept-token-actions";
import {
  AcceptSuccessPanel,
  formatBudgetCents,
  formatFeeRateLabel,
} from "@/components/accept-success-panel";
import { ContractorSidebar } from "@/components/contractor-sidebar";
import { ContractorTabs } from "@/components/contractor-tabs";
import { UserMenu } from "@/components/auth/user-menu";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { ExitViewAsButton } from "@/components/auth/exit-view-as";
import { iconSrcFor } from "@/lib/project-icons";
import { timeUntil } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { loadSuccessFeeTiers, resolveSuccessFeeForValue } from "@/lib/domain/success-fee";
import {
  hasResolvedLeadSnapshot,
  leadCategoryIcon,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";

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

function initialsFrom(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function AcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  const clerk = authMode() === "clerk";

  const rawMatch = await prisma.leadMatch.findUnique({
    where: { acceptToken: token },
    include: {
      contractor: { select: { id: true, name: true, contractorType: { select: { name: true } } } },
      lead: { include: leadDisplayInclude },
    },
  });
  const match =
    rawMatch && hasResolvedLeadSnapshot(rawMatch.lead)
      ? { ...rawMatch, lead: rawMatch.lead }
      : null;

  const expired =
    !!match &&
    (match.status === "EXPIRED" ||
      match.lead.status === "EXPIRED" ||
      match.lead.expiresAt.getTime() <= Date.now());
  const pending = !!match && match.status !== "ACCEPTED" && match.status !== "DECLINED" && !expired;

  const iconSrc = match
    ? iconSrcFor({
        icon: leadCategoryIcon(match.lead),
        category: leadCategoryLabel(match.lead),
        project: leadScopeLabel(match.lead),
      })
    : "/icons/fallback.png";
  const categoryName = match ? leadCategoryLabel(match.lead) : null;

  // Token never grants portal access — shell only when this contractor is already signed in.
  const hasContractorSession =
    !!match &&
    session.role === "contractor" &&
    session.contractorId === match.contractorId &&
    !session.deactivated;

  let estimatedBudgetLabel: string | null = null;
  let feeRateLabel: string | null = null;
  let estimatedFeeLabel: string | null = null;
  if (match) {
    const estimate = match.lead.budgetCents ?? match.lead.priceCents;
    estimatedBudgetLabel = formatBudgetCents(estimate);
    if (estimate && estimate > 0) {
      try {
        const tiers = await loadSuccessFeeTiers(prisma);
        const resolved = resolveSuccessFeeForValue(tiers, estimate);
        feeRateLabel = formatFeeRateLabel(resolved.rateBasisPoints);
        estimatedFeeLabel = formatMoney(resolved.feeAmountCents);
      } catch {
        /* non-fatal */
      }
    }
  }

  const successPanel =
    match && match.status === "ACCEPTED" ? (
      <AcceptSuccessPanel
        matchId={match.id}
        projectName={leadScopeLabel(match.lead)}
        categoryName={categoryName}
        location={match.lead.propertyLocation}
        iconSrc={iconSrc}
        estimatedBudgetLabel={estimatedBudgetLabel}
        feeRateLabel={feeRateLabel}
        estimatedFeeLabel={estimatedFeeLabel}
        landownerName={
          match.lead.landownerName ||
          [match.lead.firstName, match.lead.lastName].filter(Boolean).join(" ") ||
          "Landowner"
        }
        landownerPhone={match.lead.landownerPhone}
        landownerEmail={match.lead.landownerEmail}
        hasContractorSession={hasContractorSession}
      />
    ) : null;

  const body = !match ? (
    <div className="px-4 py-8">
      <Notice text="This opportunity link is not valid. It may have been mistyped or removed." />
    </div>
  ) : match.status === "ACCEPTED" ? (
    successPanel
  ) : match.status === "DECLINED" ? (
    <div className="px-4 py-8">
      <Notice text="You passed on this opportunity." />
    </div>
  ) : expired ? (
    <div className="px-4 py-8">
      <Notice text="This opportunity has expired and can no longer be accepted." />
    </div>
  ) : (
    <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-4">
      <div className="rounded-[20px] border border-[#EBE3D4] bg-[#FFFDF9] p-5 shadow-[0_12px_32px_rgba(58,53,45,0.10)]">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-[#F5EEDF]">
            <Image
              src={iconSrc}
              alt=""
              aria-hidden
              width={40}
              height={40}
              className="h-7 w-7 object-contain"
            />
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

        <div className="mb-3 flex flex-wrap gap-2">
          {categoryName && (
            <span className="rounded-full bg-[#F4EAD3] px-2.5 py-1 text-[12px] font-medium text-[#8A6B2E]">
              {categoryName}
            </span>
          )}
          {match.lead.landType && (
            <span className="rounded-full bg-[#F0EADD] px-2.5 py-1 text-[12px] font-medium text-[#6B6459]">
              {match.lead.landType.name}
            </span>
          )}
          <span className="rounded-full bg-[#F0EADD] px-2.5 py-1 text-[12px] font-medium text-[#6B6459]">
            {timeUntil(match.lead.expiresAt)}
          </span>
        </div>

        {(estimatedBudgetLabel || estimatedFeeLabel || feeRateLabel) && (
          <div className="mb-4 space-y-1">
            {estimatedBudgetLabel && (
              <p className="text-[15px] font-semibold text-[#3A352D]">
                Estimated budget {estimatedBudgetLabel}
              </p>
            )}
            <p className="text-[14px] text-[#8A6B2E]">
              Landy&apos;s fee{" "}
              {estimatedFeeLabel ?? feeRateLabel ?? "if you win"}
              {estimatedFeeLabel && feeRateLabel ? ` · ${feeRateLabel}` : ""} — pay only when you get
              paid
            </p>
          </div>
        )}

        {!estimatedBudgetLabel && !estimatedFeeLabel && (
          <>
            <p className="text-[13px] font-medium text-[#6B6459]">Success fee if you win</p>
            <p className="mt-0.5 text-[18px] font-semibold leading-snug text-[#3A352D]">
              Pay only when you get paid — no upfront lead cost.
            </p>
          </>
        )}

        <div className="mt-4">
          <AcceptTokenActions token={token} />
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[#A79E8D]">
          <Lock className="h-3.5 w-3.5" /> Contact unlocks after you accept
        </p>
      </div>
    </div>
  );

  if (hasContractorSession && match) {
    return (
      <div className="contractor-shell">
        <ContractorSidebar
          name={match.contractor.name}
          subtitle={match.contractor.contractorType?.name}
          initials={initialsFrom(match.contractor.name)}
          userMenu={clerk ? <UserMenu /> : undefined}
          showSignOut={clerk}
          viewingAs={session.viewingAs}
        />
        <main className="contractor-main">
          <header className="contractor-mobile-header">
            <Link href="/dashboard" className="flex min-w-0 flex-none items-baseline gap-2 pl-0.5">
              <span className="font-vibes text-[26px] leading-none text-[#5C5142]">Landys</span>
              <span className="brand-pro">Pro</span>
            </Link>
            <div className="ml-auto flex flex-none items-center gap-1">
              {session.viewingAs && <ExitViewAsButton variant="mobile" />}
              {clerk && <SignOutLink variant="icon" />}
              {clerk && <UserMenu />}
            </div>
          </header>
          <div className="contractor-page flex-1 pb-24 md:pb-0">{body}</div>
        </main>
        <ContractorTabs />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#FEFBF6] font-inter">
      <header className="px-4 pb-1 pt-5 text-center">
        <Wordmark />
        {pending && (
          <p className="mt-2 text-[15px] text-[#6B6459]">
            You&apos;ve got a new opportunity near you.
          </p>
        )}
        {match?.status === "ACCEPTED" && (
          <p className="mt-2 text-[15px] text-[#6B6459]">Contact is unlocked — reach out today.</p>
        )}
      </header>
      {body}
    </main>
  );
}
