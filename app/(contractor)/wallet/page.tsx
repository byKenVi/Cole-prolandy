import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
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
  CARD_REFUND: "Refund to card",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: "success" | "error" | "pending" | string }>;
}) {
  const { topup } = await searchParams;
  const session = await getSession();
  if (!session.contractorId) {
    return (
      <div className="px-5 py-10 md:px-[34px]">
        <EmptyState title="No contractor selected" description="Pick a contractor in the dev bar." />
      </div>
    );
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: session.contractorId },
    select: { walletBalanceCents: true, stripeDefaultPaymentMethodId: true },
  });
  const hasSavedCard = Boolean(contractor?.stripeDefaultPaymentMethodId);
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
    <div className="flex min-h-full flex-col">
      <header className="border-b border-[#EDE4D3] px-5 pb-5 pt-6 md:px-[34px] md:pt-[26px]">
        <h1 className="font-fraunces text-[30px] font-semibold tracking-[-0.01em] text-[#3A352D]">
          Wallet
        </h1>
        <p className="mt-[5px] text-[14px] text-[#8A7E68]">
          Add funds to accept leads. Money in is real; promo credit is labeled.
        </p>
      </header>

      <div className="flex-1 px-5 py-6 md:px-[34px]">
        {topup === "success" && <Banner tone="ok">Funds added successfully.</Banner>}
        {topup === "pending" && (
          <Banner tone="info">
            Payment received — your balance updates in a few seconds once the card payment confirms.
          </Banner>
        )}
        {topup === "error" && (
          <Banner tone="err">Top-up could not be completed. Please try again.</Banner>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            {/* Balance hero — taller */}
            <div className="flex min-h-[200px] flex-col rounded-[18px] bg-[#3B372F] p-7 shadow-[0_10px_30px_rgba(58,53,45,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A9084]">
                Current balance
              </p>
              <div className="flex flex-1 items-center">
                <p className="text-[52px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#F6EEDF]">
                  {formatMoney(contractor?.walletBalanceCents ?? 0)}
                </p>
              </div>
              {promoTotalCents > 0 && (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-[#E0A95C]">
                  Includes {formatMoney(promoTotalCents)} promo credit
                </span>
              )}
            </div>

            {/* Add funds */}
            <div className="rounded-[18px] border border-[#EBE3D4] bg-white p-6 shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
              <h2 className="mb-4 text-[17px] font-semibold text-[#3A352D]">Add funds</h2>
              <TopUp hasSavedCard={hasSavedCard} />
            </div>
          </div>

          {/* History */}
          <div className="rounded-[18px] border border-[#EBE3D4] bg-white p-6 shadow-[0_2px_8px_rgba(58,53,45,0.05)]">
            <h2 className="mb-4 text-[17px] font-semibold text-[#3A352D]">Transaction history</h2>
            {txns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="font-medium text-[#3A352D]">No transactions yet</p>
                <p className="mt-1 text-sm text-[#8A7E68]">Your top-ups and charges will show here.</p>
              </div>
            ) : (
              <div className="-mx-2 divide-y divide-[#F2EBDD]">
                {txns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-2 py-3.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-[#3A352D]">
                        {TYPE_LABEL[t.type] ?? t.type}
                        {t.type === "PROMO_CREDIT" && <Badge variant="warning">Promo</Badge>}
                      </p>
                      <p className="text-xs text-[#A79E8D]">{formatDate(t.createdAt)}</p>
                      {t.note && <p className="truncate text-xs text-[#A79E8D]">{t.note}</p>}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        t.amountCents >= 0 ? "text-[#1E7A4C]" : "text-[#C0392B]",
                      )}
                    >
                      {t.amountCents >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(t.amountCents))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "info" | "err"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "bg-[#E7F0E9] text-[#2F6B4A]"
      : tone === "err"
        ? "bg-[#F6E4E1] text-[#9A3B2E]"
        : "bg-[#F4EAD3] text-[#8A6B2E]";
  return <p className={`mb-6 rounded-[12px] p-3 text-sm font-medium ${styles}`}>{children}</p>;
}
