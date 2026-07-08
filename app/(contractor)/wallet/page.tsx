import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WalletBalance } from "@/components/wallet-balance";
import { TopUp } from "@/components/topup";
import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Top-up (card)",
  LEAD_CHARGE: "Lead charge",
  REFUND: "Refund credit",
  ADMIN_ADJUST: "Admin correction",
  PROMO_CREDIT: "Promo credit",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: "success" | "error" | "pending" | string }>;
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
  const [txns, promoAgg] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { contractorId: session.contractorId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.walletTransaction.aggregate({
      _sum: { amountCents: true },
      where: { contractorId: session.contractorId, type: "PROMO_CREDIT" },
    }),
  ]);
  const promoTotalCents = promoAgg._sum.amountCents ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="pt-1 text-xl font-semibold text-text">Wallet</h1>

      {topup === "success" && (
        <p className="rounded-sm bg-success-soft p-3 text-sm font-medium text-success">
          Funds added successfully.
        </p>
      )}
      {topup === "pending" && (
        <p className="rounded-sm bg-primary-soft p-3 text-sm font-medium text-text">
          Payment received — your balance updates in a few seconds once the card payment confirms.
        </p>
      )}
      {topup === "error" && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">
          Top-up could not be completed. Please try again.
        </p>
      )}

      <Card className="bg-primary-soft p-6">
        <WalletBalance cents={contractor?.walletBalanceCents ?? 0} size="hero" label="Current balance" />
        {promoTotalCents > 0 && (
          <p className="mt-2 text-xs font-medium text-warning">
            Includes {formatMoney(promoTotalCents)} promotional credit
          </p>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Add funds</CardTitle>
        </CardHeader>
        <TopUp />
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text">Transaction history</h2>
        {txns.length === 0 ? (
          <EmptyState title="No transactions yet" description="Your top-ups and charges will show here." />
        ) : (
          <Card className="divide-y divide-border p-0">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="flex items-center gap-2 font-medium text-text">
                    {TYPE_LABEL[t.type] ?? t.type}
                    {t.type === "PROMO_CREDIT" && <Badge variant="warning">Promo</Badge>}
                  </p>
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
