import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { expireLeads } from "@/lib/domain/leads";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DEFAULT_PAGE_SIZE, paginationMeta, parsePage } from "@/lib/pagination";
import { ContractorFeed, type FeedRow } from "./feed-client";

export const dynamic = "force-dynamic";

export default async function ContractorHome({
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

  const matches = await prisma.leadMatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: { lead: { include: { projectType: { include: { contractorType: true } } } } },
  });

  const rows: FeedRow[] = matches.map((m) => ({
    matchId: m.id,
    projectTypeName: m.lead.projectType.name,
    categoryName: m.lead.projectType.contractorType.name,
    categoryIcon: m.lead.projectType.contractorType.icon,
    location: m.lead.propertyLocation,
    tier: m.lead.tier,
    priceCents: m.lead.priceCents,
    receivedAt: m.createdAt,
  }));

  return (
    <ContractorFeed
      rows={rows}
      walletCents={contractor.walletBalanceCents}
      pagination={{ page, totalPages, totalCount }}
    />
  );
}

function NoContractor() {
  return (
    <div className="px-5 py-10 md:px-[34px]">
      <EmptyState
        title="Let's set up your profile"
        description="Tell us about your business to start receiving leads."
        action={
          <Button asChild variant="accent" size="cta">
            <Link href="/profile">Get started</Link>
          </Button>
        }
      />
    </div>
  );
}
