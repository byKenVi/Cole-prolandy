import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadSuccessFeeTiers } from "@/lib/domain/success-fee";
import { matchViewInclude, toMatchView } from "@/lib/contractor-views";
import { OpportunityView } from "./opportunity-view";
import { JobActionArea } from "./job-action-area";
import { PageHead } from "./ui";

/** Detail page shared by /opportunities/[id] and /jobs/[id]. */
export async function MatchDetail({ id }: { id: string }) {
  const session = await getSession();
  const match = await prisma.leadMatch.findUnique({
    where: { id },
    include: {
      ...matchViewInclude,
      contractor: { select: { stripeDefaultPaymentMethodId: true, cardBrand: true, cardLast4: true } },
    },
  });
  if (!match || !session.contractorId || match.contractorId !== session.contractorId) notFound();

  const tiers = await loadSuccessFeeTiers(prisma);
  const view = await toMatchView(match, tiers);
  const isRequest = ["open", "expired", "declined", "taken"].includes(view.state);
  const savedCard = match.contractor.stripeDefaultPaymentMethodId
    ? { brand: match.contractor.cardBrand, last4: match.contractor.cardLast4 }
    : null;

  return (
    <>
      <PageHead
        title={isRequest ? "Job request" : "My job"}
        back={isRequest ? { href: "/opportunities", label: "All requests" } : { href: "/jobs", label: "All my jobs" }}
      />
      <OpportunityView view={view} viaToken={false}>
        <JobActionArea view={view} target={{ kind: "portal", matchId: view.id }} tiers={tiers} savedCard={savedCard} />
      </OpportunityView>
    </>
  );
}
