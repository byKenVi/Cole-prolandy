import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { expireLeads } from "@/lib/domain/leads";
import { loadSuccessFeeTiers, resolveSuccessFeeForValue } from "@/lib/domain/success-fee";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";
import {
  hasResolvedLeadSnapshot,
  leadCategoryIcon,
  leadCategoryLabel,
  leadDisplayInclude,
  leadScopeLabel,
} from "@/lib/resolved-lead";
import { ContractorFeed, type FeedRow } from "../home/feed-client";

export const dynamic = "force-dynamic";

function estimatedValueCents(lead: { budgetCents: number | null; priceCents: number | null }) {
  return lead.budgetCents ?? lead.priceCents;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session.contractorId) return <NoContractor />;

  await expireLeads(prisma).catch(() => undefined);

  const contractor = await prisma.contractor.findUnique({
    where: { id: session.contractorId },
    include: { contractorType: true },
  });
  if (!contractor) return <NoContractor />;

  const where = { contractorId: contractor.id, status: "PENDING" as const };
  const requestedPage = parsePage((await searchParams).page);
  const totalCount = await prisma.leadMatch.count({ where });
  const { page, skip, take, totalPages } = paginationMeta(
    totalCount,
    requestedPage,
    DEFAULT_PAGE_SIZE,
  );

  const [matches, tiers] = await Promise.all([
    prisma.leadMatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { lead: { include: leadDisplayInclude } },
    }),
    loadSuccessFeeTiers(prisma),
  ]);

  const rows: FeedRow[] = matches.flatMap((m) => {
    if (!hasResolvedLeadSnapshot(m.lead)) return [];
    const estimate = estimatedValueCents(m.lead);
    let feeRatePercent: number | undefined;
    if (estimate && estimate > 0 && tiers.length > 0) {
      try {
        const { rateBasisPoints } = resolveSuccessFeeForValue(tiers, estimate);
        feeRatePercent = rateBasisPoints / 100;
      } catch {
        // Non-fatal — card renders without a rate preview.
      }
    }
    return [
      {
        matchId: m.id,
        projectTypeName: leadScopeLabel(m.lead),
        categoryName: leadCategoryLabel(m.lead),
        categoryIcon: leadCategoryIcon(m.lead) ?? null,
        location: m.lead.propertyLocation,
        tier: m.lead.tier,
        feeRatePercent,
        estimatedValueLabel: estimate && estimate > 0 ? formatMoney(estimate) : null,
        receivedAt: m.createdAt,
        expiresAt: m.lead.expiresAt,
      },
    ];
  });

  return (
    <ContractorFeed
      rows={rows}
      pathname="/opportunities"
      pagination={{ page, totalPages, totalCount, pageSize: DEFAULT_PAGE_SIZE }}
    />
  );
}

function NoContractor() {
  return (
    <div className="px-5 py-10 md:px-[34px]">
      <EmptyState
        title="Let's set up your profile"
        description="Tell us about your business to start receiving opportunities."
        action={
          <Button asChild variant="accent" size="cta">
            <Link href="/profile">Get started</Link>
          </Button>
        }
      />
    </div>
  );
}
