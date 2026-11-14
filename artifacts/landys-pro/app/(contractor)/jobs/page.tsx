import { getSession } from "@/lib/auth";
import { loadMatchViews } from "@/lib/contractor-views";
import { JobTicket } from "@/components/pro/job-ticket";
import { Empty, LinkButton, PageHead, Section } from "@/components/pro/ui";

export const dynamic = "force-dynamic";

export default async function MyJobsPage() {
  const session = await getSession();
  if (!session.contractorId) return <PageHead title="My jobs" intro="Sign in to see your jobs." />;
  const all = await loadMatchViews({
    contractorId: session.contractorId,
    where: { status: "ACCEPTED" },
    orderBy: { acceptedAt: "desc" },
    take: 100,
  });
  const active = all.filter((v) => ["accepted", "won_waiting_payment", "fee_due"].includes(v.state));
  const finished = all.filter((v) => !["accepted", "won_waiting_payment", "fee_due"].includes(v.state));

  return (
    <>
      <PageHead
        title="My jobs"
        intro="Requests you accepted. Tell us if you got the job; you only pay Landy's when you win and get paid."
      />
      {all.length === 0 ? (
        <Empty
          title="No jobs yet"
          action={<LinkButton href="/opportunities" variant="secondary">See job requests</LinkButton>}
        >
          When you accept a request, the homeowner&apos;s contact and the job show up here.
        </Empty>
      ) : (
        <>
          {active.length > 0 ? (
            <div className="pro-stack">
              {active.map((view) => (
                <JobTicket key={view.id} view={view} href={`/jobs/${view.id}`} />
              ))}
            </div>
          ) : (
            <Empty title="Nothing to update">All your jobs are up to date.</Empty>
          )}
          {finished.length > 0 && (
            <Section title="Finished">
              <div className="pro-stack">
                {finished.map((view) => (
                  <JobTicket key={view.id} view={view} href={`/jobs/${view.id}`} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
}
