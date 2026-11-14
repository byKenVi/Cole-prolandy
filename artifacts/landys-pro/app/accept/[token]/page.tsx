import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadSuccessFeeTiers } from "@/lib/domain/success-fee";
import { matchViewInclude, toMatchView } from "@/lib/contractor-views";
import { PublicFrame } from "@/components/pro/shell";
import { OpportunityView } from "@/components/pro/opportunity-view";
import { JobActionArea } from "@/components/pro/job-action-area";
import { Notice, PageHead } from "@/components/pro/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Job request - Landy's Pro", robots: { index: false } };

/**
 * Opened from the new-job text message. Works without an account: the token in
 * the link identifies the contractor for THIS request only.
 */
export default async function AcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const match = await prisma.leadMatch.findUnique({
    where: { acceptToken: token },
    include: { ...matchViewInclude, contractor: { select: { name: true } } },
  });

  if (!match || (!match.lead.expiresAt && match.status === "PENDING")) {
    return (
      <PublicFrame>
        <PageHead title="This link does not work" />
        <Notice>
          The link may be incomplete. Open the latest text or email from Landy&apos;s Pro, or sign in to see all your
          job requests.
        </Notice>
        <div style={{ marginTop: 20 }}>
          <Link href="/sign-in" className="pro-btn pro-btn--secondary">
            Sign in
          </Link>
        </div>
      </PublicFrame>
    );
  }

  const [tiers, session] = await Promise.all([loadSuccessFeeTiers(prisma), getSession()]);
  const view = await toMatchView(match, tiers);
  const signedInAsThisPro = session.role === "contractor" && session.contractorId === match.contractorId;
  const firstName = match.contractor.name.split(/\s+/)[0] ?? match.contractor.name;

  const heading =
    view.state === "open"
      ? view.direct
        ? "A homeowner asked you for an estimate"
        : "New job request near you"
      : view.state === "accepted"
        ? "Accepted. Call the homeowner today."
        : view.summary.title;

  return (
    <PublicFrame>
      <PageHead
        title={heading}
        intro={view.state === "open" ? `Hi ${firstName}, here are the details. Accepting costs nothing.` : undefined}
      />
      <OpportunityView view={view} viaToken>
        <JobActionArea view={view} target={{ kind: "token", token }} tiers={tiers} allowPayment={false} />
      </OpportunityView>

      <p className="pro-small" style={{ margin: "22px 0 0", textAlign: "center" }}>
        You get these job requests because you are listed as a pro on landys.co. Reply STOP to any text to stop texts.{" "}
        <Link href="/privacy" className="pro-link" style={{ display: "inline", minHeight: 0, fontSize: 16 }}>
          Privacy
        </Link>
      </p>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        {signedInAsThisPro ? (
          <Link href="/dashboard" className="pro-link">
            Go to my account
          </Link>
        ) : (
          <p className="pro-small" style={{ margin: 0 }}>
            Want all your jobs in one place?{" "}
            <Link href="/sign-in" className="pro-link" style={{ display: "inline", minHeight: 0 }}>
              Sign in to your free account
            </Link>
          </p>
        )}
      </div>
    </PublicFrame>
  );
}
