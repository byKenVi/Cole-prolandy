import { getSession } from "@/lib/auth";
import { loadMatchViews, openRequestWhere } from "@/lib/contractor-views";
import { JobTicket } from "@/components/pro/job-ticket";
import { Empty, PageHead, Section } from "@/components/pro/ui";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const session = await getSession();
  if (!session.contractorId) return <PageHead title="Job requests" intro="Sign in to see your job requests." />;
  const now = new Date();
  const [open, past] = await Promise.all([
    loadMatchViews({ contractorId: session.contractorId, where: openRequestWhere(now), take: 50 }),
    loadMatchViews({
      contractorId: session.contractorId,
      where: { status: { in: ["PENDING", "DECLINED", "EXPIRED", "SOLD_OUT"] }, NOT: openRequestWhere(now) },
      take: 10,
    }),
  ]);

  return (
    <>
      <PageHead
        title="Job requests"
        intro="Homeowners near you who asked for an estimate. Accepting is free; the first pros to accept get the contact."
      />
      {open.length === 0 ? (
        <Empty title="No requests waiting">New requests arrive by text and show up here right away.</Empty>
      ) : (
        <div className="pro-stack">
          {open.map((view) => (
            <JobTicket key={view.id} view={view} href={`/opportunities/${view.id}`} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <Section title="Closed requests">
          <div className="pro-stack">
            {past.map((view) => (
              <JobTicket key={view.id} view={view} href={`/opportunities/${view.id}`} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
