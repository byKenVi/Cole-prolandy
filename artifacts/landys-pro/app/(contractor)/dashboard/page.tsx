import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadMatchViews, openRequestWhere } from "@/lib/contractor-views";
import { JobTicket } from "@/components/pro/job-ticket";
import { Empty, Notice, PageHead, Section } from "@/components/pro/ui";

export const dynamic = "force-dynamic";

export default async function ContractorHome() {
  const session = await getSession();
  if (!session.contractorId) {
    return (
      <>
        <PageHead title="Welcome to Landy's Pro" intro="Your account is not linked to a contractor profile yet." />
        <Notice title="Almost there">
          Sign in with the email address listed on your landys.co profile, or call Landy&apos;s so we can link your
          account.
        </Notice>
        <div style={{ marginTop: 18 }}>
          <Link href="/profile" className="pro-btn pro-btn--secondary">
            Open my account
          </Link>
        </div>
      </>
    );
  }
  const contractorId = session.contractorId;
  const now = new Date();

  const [contractor, feesDue, requests, toUpdate] = await Promise.all([
    prisma.contractor.findUnique({
      where: { id: contractorId },
      select: { name: true, leadsPausedUntil: true },
    }),
    loadMatchViews({
      contractorId,
      where: { status: "ACCEPTED", successFee: { status: "DUE" } },
      orderBy: { updatedAt: "asc" },
      take: 3,
    }),
    loadMatchViews({ contractorId, where: openRequestWhere(now), take: 5 }),
    loadMatchViews({
      contractorId,
      where: {
        status: "ACCEPTED",
        OR: [{ jobOutcome: "OPEN" }, { jobOutcome: "WON", successFee: { status: "AWAITING_CONTRACTOR_PAYMENT" } }],
      },
      orderBy: { acceptedAt: "desc" },
      take: 4,
    }),
  ]);

  const name = contractor?.name ?? "there";
  const paused = contractor?.leadsPausedUntil && contractor.leadsPausedUntil > now ? contractor.leadsPausedUntil : null;

  const intro =
    feesDue.length > 0
      ? `You have ${feesDue.length} Landy's fee${feesDue.length > 1 ? "s" : ""} to pay.`
      : requests.length > 0
        ? `${requests.length} new job request${requests.length > 1 ? "s are" : " is"} waiting for your answer.`
        : "You are all caught up. We will text you as soon as a new job comes in.";

  return (
    <>
      <PageHead title={`Hello, ${name}`} intro={intro} />

      {paused && (
        <Notice tone="warn" title="New job requests are paused">
          Until {paused.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.{" "}
          <Link href="/profile#pause" className="pro-link" style={{ display: "inline", minHeight: 0 }}>
            Change
          </Link>
        </Notice>
      )}

      {feesDue.length > 0 && (
        <Section title="Fees to pay" link={{ href: "/fees", label: "All fees" }}>
          <div className="pro-stack">
            {feesDue.map((view) => (
              <JobTicket key={view.id} view={view} href={`/jobs/${view.id}`} />
            ))}
          </div>
        </Section>
      )}

      <Section title="New job requests" link={requests.length ? { href: "/opportunities", label: "See all" } : undefined}>
        {requests.length === 0 ? (
          <Empty title="No new requests right now">
            When a homeowner near you asks for an estimate, you get a text and it shows up here.
          </Empty>
        ) : (
          <div className="pro-stack">
            {requests.map((view) => (
              <JobTicket key={view.id} view={view} href={`/opportunities/${view.id}`} />
            ))}
          </div>
        )}
      </Section>

      {toUpdate.length > 0 && (
        <Section title="Jobs to follow up" link={{ href: "/jobs", label: "All my jobs" }}>
          <div className="pro-stack">
            {toUpdate.map((view) => (
              <JobTicket key={view.id} view={view} href={`/jobs/${view.id}`} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
