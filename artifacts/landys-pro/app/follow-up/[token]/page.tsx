import Link from "next/link";
import { FollowUpAction } from "@prisma/client";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { loadSuccessFeeTiers } from "@/lib/domain/success-fee";
import { matchViewInclude, toMatchView, type MatchView } from "@/lib/contractor-views";
import { onlinePaymentsAvailable } from "@/lib/integrations/payments";
import { PublicFrame } from "@/components/pro/shell";
import { OutcomeActions, PaidActions, PayFeeButton } from "@/components/pro/job-actions";
import { Facts, Notice, PageHead, Perforation } from "@/components/pro/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quick update", robots: { index: false, follow: false } };

function JobStub({ view, children }: { view: MatchView; children: React.ReactNode }) {
  return (
    <article className="pro-ticket">
      <div className="pro-ticket-top">
        <div className="pro-ticket-kind">{view.summary.title}</div>
        <p className="pro-ticket-place">{view.summary.cityState ?? view.summary.place}</p>
        <p className="pro-ticket-sub">
          <MapPin size={16} aria-hidden style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Homeowner: {view.landowner.name}
        </p>
      </div>
      <Perforation />
      <div className="pro-ticket-body" style={{ paddingTop: 10 }}>
        {children}
      </div>
    </article>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PublicFrame>
      <PageHead title={title} />
      {children}
      <div style={{ marginTop: 22 }}>
        <Link href="/sign-in" className="pro-btn pro-btn--secondary">
          Sign in to see all your jobs
        </Link>
      </div>
    </PublicFrame>
  );
}

/**
 * Login-free follow-up links sent by text and email:
 *  - REPORT_OUTCOME: "Did you get the job?"
 *  - CONFIRM_PAID:   "Has the homeowner paid you?"
 *  - PAY_FEE:        pay Landy's success fee by card
 */
export default async function FollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  const row = await prisma.followUpToken.findUnique({
    where: { token },
    include: { leadMatch: { include: matchViewInclude } },
  });

  if (!row?.leadMatch) {
    return (
      <Message title="This link does not work">
        <Notice>The link may be incomplete. Open the latest text or email from Landy&apos;s Pro.</Notice>
      </Message>
    );
  }

  const tiers = await loadSuccessFeeTiers(prisma);
  const view = await toMatchView(row.leadMatch, tiers);
  const expired = row.expiresAt.getTime() <= Date.now();

  // ── Pay the fee ─────────────────────────────────────────
  if (row.action === FollowUpAction.PAY_FEE) {
    if (view.fee?.status === "PAID") {
      return (
        <Message title="Thank you, your fee is paid">
          <Notice tone="ok">
            We received {formatMoney(view.fee.amountCents)} for the {view.summary.title} job. A receipt was sent to
            your email by Stripe.
          </Notice>
        </Message>
      );
    }
    if (paid === "1") {
      return (
        <Message title="Payment received">
          <Notice tone="ok">
            Thank you. Stripe is confirming your payment; this page will show &ldquo;paid&rdquo; within a minute.
          </Notice>
        </Message>
      );
    }
    if (!view.fee || view.fee.status !== "DUE" || expired) {
      return (
        <Message title={expired ? "This payment link has expired" : "Nothing to pay right now"}>
          <Notice>
            {expired
              ? "Sign in to pay from your account, or reply to our email and we will send a new link."
              : "This fee is not due yet."}
          </Notice>
        </Message>
      );
    }
    return (
      <PublicFrame>
        <PageHead title="Pay Landy's success fee" intro="You told us the homeowner paid you. Thank you for working with Landy's." />
        <JobStub view={view}>
          <p className="pro-small" style={{ margin: 0 }}>
            Amount to pay
          </p>
          <p className="pro-money" style={{ margin: "2px 0 14px", fontSize: 46, fontWeight: 600, lineHeight: 1.05 }}>
            {formatMoney(view.fee.amountCents)}
          </p>
          <Facts
            items={[
              { label: "Final job price", value: formatMoney(view.fee.finalValueCents) },
              { label: "Fee rate", value: view.fee.ratePercentLabel },
            ]}
          />
          <div style={{ marginTop: 20 }}>
            {onlinePaymentsAvailable() ? (
              <PayFeeButton target={{ kind: "token", token }} amountLabel={formatMoney(view.fee.amountCents)} />
            ) : (
              <Notice title="Online payment opens soon">
                Landy&apos;s will contact you to collect this fee. You do not need to do anything now.
              </Notice>
            )}
          </div>
          <p className="pro-small" style={{ margin: "14px 0 0" }}>
            Wrong amount? Reply to our email before paying and we will fix it.
          </p>
        </JobStub>
      </PublicFrame>
    );
  }

  // ── Outcome / payment questions ─────────────────────────
  if (row.usedAt) {
    return (
      <Message title="Thank you, your answer is saved">
        <Notice tone="ok">You can close this page.</Notice>
      </Message>
    );
  }
  if (expired) {
    return (
      <Message title="This link has expired">
        <Notice>Sign in to update this job from your account, or wait for our next text.</Notice>
      </Message>
    );
  }

  if (row.action === FollowUpAction.REPORT_OUTCOME) {
    if (view.state !== "accepted") {
      return (
        <Message title="Already answered">
          <Notice tone="ok">We already have your answer for this job. Thank you.</Notice>
        </Message>
      );
    }
    return (
      <PublicFrame>
        <PageHead title="Did you get the job?" intro="One quick answer helps us close this request." />
        <JobStub view={view}>
          <OutcomeActions target={{ kind: "token", token }} homeownerName={view.landowner.name} tiers={tiers} />
        </JobStub>
      </PublicFrame>
    );
  }

  if (row.action === FollowUpAction.CONFIRM_PAID) {
    if (view.state !== "won_waiting_payment") {
      return (
        <Message title="Already answered">
          <Notice tone="ok">We already have your answer for this job. Thank you.</Notice>
        </Message>
      );
    }
    return (
      <PublicFrame>
        <PageHead
          title="Have you been paid?"
          intro={`You won this job${view.finalContractValueCents ? ` for ${formatMoney(view.finalContractValueCents)}` : ""}. Landy's fee is due only once the homeowner pays you.`}
        />
        <JobStub view={view}>
          <PaidActions target={{ kind: "token", token }} homeownerName={view.landowner.name} />
        </JobStub>
      </PublicFrame>
    );
  }

  return (
    <Message title="This link does not work">
      <Notice>Open the latest text or email from Landy&apos;s Pro.</Notice>
    </Message>
  );
}
