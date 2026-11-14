import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { loadMatchViews } from "@/lib/contractor-views";
import { JobTicket } from "@/components/pro/job-ticket";
import { Empty, Notice, PageHead, Section } from "@/components/pro/ui";

export const dynamic = "force-dynamic";

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const { paid } = await searchParams;
  const session = await getSession();
  if (!session.contractorId) return <PageHead title="Fees" intro="Sign in to see your fees." />;
  const contractorId = session.contractorId;

  const [due, waiting, paidFees] = await Promise.all([
    loadMatchViews({ contractorId, where: { successFee: { status: "DUE" } }, orderBy: { updatedAt: "asc" } }),
    loadMatchViews({ contractorId, where: { successFee: { status: "AWAITING_CONTRACTOR_PAYMENT" } } }),
    prisma.successFee.findMany({
      where: { status: "PAID", leadMatch: { contractorId } },
      orderBy: { paidAt: "desc" },
      take: 50,
      select: {
        id: true,
        leadMatchId: true,
        feeAmountCents: true,
        paidAt: true,
        leadMatch: {
          select: { lead: { select: { contractorCategory: { select: { name: true } }, workType: { select: { name: true } } } } },
        },
      },
    }),
  ]);
  const totalPaid = paidFees.reduce((sum, f) => sum + f.feeAmountCents, 0);

  return (
    <>
      <PageHead
        title="Fees"
        intro="Landy's charges a fee only on jobs you won, and only after the homeowner paid you."
      />

      {paid && (
        <div style={{ marginBottom: 20 }}>
          <Notice tone="ok" title="Payment received">
            Thank you. It can take a minute for the fee to show as paid.
          </Notice>
        </div>
      )}

      {due.length > 0 ? (
        <div className="pro-stack">
          {due.map((view) => (
            <JobTicket key={view.id} view={view} href={`/jobs/${view.id}`} />
          ))}
        </div>
      ) : (
        <Empty title="Nothing to pay">You have no Landy&apos;s fee due right now.</Empty>
      )}

      {waiting.length > 0 && (
        <Section title="Won, waiting for the homeowner to pay you">
          <div className="pro-stack">
            {waiting.map((view) => (
              <JobTicket key={view.id} view={view} href={`/jobs/${view.id}`} />
            ))}
          </div>
        </Section>
      )}

      {paidFees.length > 0 && (
        <Section title="Paid">
          <div className="pro-card" style={{ padding: 0 }}>
            <p style={{ margin: 0, padding: "16px 20px", borderBottom: "1px solid var(--pro-line)" }}>
              Total paid to Landy&apos;s: <strong className="pro-money">{formatMoney(totalPaid)}</strong>
            </p>
            {paidFees.map((fee) => (
              <Link
                key={fee.id}
                href={`/jobs/${fee.leadMatchId}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 20px",
                  minHeight: 56,
                  borderTop: "1px solid var(--pro-line)",
                  textDecoration: "none",
                }}
              >
                <span>
                  {fee.leadMatch.lead.contractorCategory?.name ?? fee.leadMatch.lead.workType?.name ?? "Job"}
                  <span className="pro-small" style={{ display: "block" }}>
                    {fee.paidAt?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </span>
                <strong className="pro-money" style={{ fontSize: 19 }}>
                  {formatMoney(fee.feeAmountCents)}
                </strong>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
