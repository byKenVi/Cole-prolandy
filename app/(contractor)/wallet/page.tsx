import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletBalance } from "@/components/wallet-balance";
import { TopUp } from "@/components/topup";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Top-up",
  LEAD_CHARGE: "Lead charge",
  REFUND: "Refund",
  ADMIN_ADJUST: "Adjustment",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string }>;
}) {
  const { topup } = await searchParams;
  const session = await getSession();
  if (!session.contractorId) {
    return <EmptyState title="No contractor selected" description="Pick a contractor in the dev bar." />;
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: session.contractorId },
    select: { walletBalanceCents: true },
  });
  const txns = await prisma.walletTransaction.findMany({
    where: { contractorId: session.contractorId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Wallet</h1>

      {topup === "success" && (
        <p className="rounded-sm bg-success-soft p-3 text-sm font-medium text-success">
          Funds added successfully.
        </p>
      )}
      {topup === "error" && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">
          Top-up could not be completed. Please try again.
        </p>
      )}

      <Card className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">Current balance</p>
        <WalletBalance cents={contractor?.walletBalanceCents ?? 0} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add funds</CardTitle>
        </CardHeader>
        <TopUp />
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">Transaction history</h2>
        {txns.length === 0 ? (
          <EmptyState title="No transactions yet" description="Your top-ups and charges will show here." />
        ) : (
          <Card className="divide-y divide-border p-0">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-text">{TYPE_LABEL[t.type] ?? t.type}</p>
                  <p className="text-xs text-text-muted">{formatDate(t.createdAt)}</p>
                  {t.note && <p className="text-xs text-text-muted">{t.note}</p>}
                </div>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    t.amountCents >= 0 ? "text-success" : "text-text",
                  )}
                >
                  {t.amountCents >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(t.amountCents))}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
