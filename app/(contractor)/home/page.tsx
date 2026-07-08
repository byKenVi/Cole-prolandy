import Link from "next/link";
import { Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { expireLeads } from "@/lib/domain/leads";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WalletBalance } from "@/components/wallet-balance";
import { LeadFeedCard, type FeedLead } from "@/components/lead-feed-card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function ContractorHome() {
  const session = await getSession();
  if (!session.contractorId) return <NoContractor />;

  // Keep the feed honest: expire stale leads on load (idempotent).
  await expireLeads(prisma).catch(() => undefined);

  const contractor = await prisma.contractor.findUnique({
    where: { id: session.contractorId },
    include: { contractorType: true },
  });
  if (!contractor) return <NoContractor />;

  const matches = await prisma.leadMatch.findMany({
    where: { contractorId: contractor.id, status: { in: ["PENDING", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    include: { lead: { include: { projectType: true } } },
  });

  const pending: FeedLead[] = [];
  const accepted: FeedLead[] = [];
  for (const m of matches) {
    const item: FeedLead = {
      matchId: m.id,
      status: m.status,
      projectTypeName: m.lead.projectType.name,
      location: m.lead.propertyLocation,
      tier: m.lead.tier,
      priceCents: m.lead.priceCents,
      expiresAt: m.lead.expiresAt,
      contact:
        m.status === "ACCEPTED"
          ? {
              name: m.lead.landownerName,
              phone: m.lead.landownerPhone,
              email: m.lead.landownerEmail,
            }
          : null,
    };
    (m.status === "PENDING" ? pending : accepted).push(item);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between pt-1">
        <div>
          <p className="text-sm text-text-muted">Welcome back</p>
          <h1 className="mt-0.5 text-xl font-semibold text-text">{contractor.name}</h1>
          <p className="text-sm text-text-muted">{contractor.contractorType.name}</p>
        </div>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <WalletBalance cents={contractor.walletBalanceCents} size="hero" label="Wallet balance" />
        <Button asChild variant="accent" size="cta">
          <Link href="/wallet">Add funds</Link>
        </Button>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">New leads</h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No new leads yet"
            description="We'll text you the moment a new job comes in."
          />
        ) : (
          pending.map((l) => <LeadFeedCard key={l.matchId} lead={l} />)
        )}
      </section>

      {accepted.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">Accepted</h2>
          {accepted.map((l) => (
            <LeadFeedCard key={l.matchId} lead={l} />
          ))}
        </section>
      )}
    </div>
  );
}

function NoContractor() {
  return (
    <EmptyState
      title="Let's set up your profile"
      description="Tell us about your business to start receiving leads."
      action={
        <Button asChild variant="accent" size="cta">
          <Link href="/profile">Get started</Link>
        </Button>
      }
    />
  );
}
