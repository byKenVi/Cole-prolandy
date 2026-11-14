import { prisma } from "@/lib/prisma";
import { buildLeadSummary } from "@/lib/lead-summary";
import { leadDisplayInclude } from "@/lib/resolved-lead";
import { PublicFrame } from "@/components/pro/shell";
import { LandownerAnswer } from "@/components/pro/landowner-answer";
import { Notice, PageHead } from "@/components/pro/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your project - Landy's", robots: { index: false } };

/** Homeowner: "Did you hire one of these pros?" (linked from our email). */
export default async function LandownerConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ choice?: string }>;
}) {
  const { token } = await params;
  const { choice } = await searchParams;
  const confirmation = await prisma.landownerConfirmation.findUnique({
    where: { token },
    include: {
      lead: {
        include: {
          ...leadDisplayInclude,
          matches: {
            where: { status: "ACCEPTED" },
            orderBy: { acceptedAt: "asc" },
            select: { id: true, contractor: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!confirmation) {
    return (
      <PublicFrame homeowner>
        <PageHead title="This link does not work" />
        <Notice>The link may be incomplete. Please open the latest email from Landy&apos;s.</Notice>
      </PublicFrame>
    );
  }

  if (confirmation.respondedAt) {
    return (
      <PublicFrame homeowner>
        <PageHead title="Thank you, we have your answer" />
        <Notice tone="ok">You can close this page. Good luck with your project.</Notice>
      </PublicFrame>
    );
  }

  const summary = await buildLeadSummary(confirmation.lead);
  const pros = confirmation.lead.matches.map((m) => ({ matchId: m.id, name: m.contractor.name }));
  const validChoice =
    choice && (choice === "none" || choice === "other" || pros.some((p) => p.matchId === choice)) ? choice : null;

  return (
    <PublicFrame homeowner>
      <PageHead
        title="Did you hire someone for your project?"
        intro={`Your ${summary.title} request in ${summary.cityState ?? summary.place}. Your answer is confidential and helps us keep only reliable pros on Landy's.`}
      />
      <div className="pro-card">
        <LandownerAnswer token={token} pros={pros} initialChoice={validChoice} />
      </div>
    </PublicFrame>
  );
}
