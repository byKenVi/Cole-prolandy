import { prisma } from "@/lib/prisma";
import { getStripeBalance, listRecentPayouts } from "@/lib/integrations/payments";
import { PageHeader } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const STRIPE_DASHBOARD_PAYOUTS_URL = "https://dashboard.stripe.com/payouts";

/** Σ amountCents for a given WalletTransaction type. */
async function sumByType(
  type: "TOPUP" | "REFUND" | "PROMO_CREDIT" | "ADMIN_ADJUST" | "LEAD_CHARGE" | "CARD_REFUND",
) {
  const agg = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type },
  });
  return agg._sum.amountCents ?? 0;
}

export default async function AdminFinance() {
  const [topup, refund, promo, adjust, leadCharge, cardRefund, walletAgg, balance, payouts] =
    await Promise.all([
      sumByType("TOPUP"),
      sumByType("REFUND"),
      sumByType("PROMO_CREDIT"),
      sumByType("ADMIN_ADJUST"),
      sumByType("LEAD_CHARGE"),
      sumByType("CARD_REFUND"),
      prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
      getStripeBalance(),
      listRecentPayouts(),
    ]);

  const grossTopup = topup;
  // CARD_REFUND is stored negative (it debits the wallet when real money goes back
  // to the card), so net card cash retained = Σ TOPUP + Σ CARD_REFUND.
  const cardRefundsOut = Math.abs(cardRefund);
  const netCashCollected = topup + cardRefund;
  const refundsIssued = refund;
  const promoIssued = promo;
  const adminCorrections = adjust;
  const leadsRecognized = Math.abs(leadCharge);
  const walletFloat = walletAgg._sum.walletBalanceCents ?? 0;

  const stripeUnavailable = balance.mocked || payouts.mocked;

  return (
    <div className="admin-fade-up">
      <PageHeader
        title="Cash & revenue"
        subtitle="Honest accounting: real card-collected cash vs. promotional credit vs. wallet liability, reconciled against the live platform Stripe account."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Section title="Real money (Stripe)" subtitle="Actual card cash and recognized spend.">
          <StatCard
            label="Net cash collected (card)"
            value={formatMoney(netCashCollected)}
            caption="Σ TOPUP minus real card refunds (CARD_REFUND) — the card cash actually retained after money sent back to contractors' cards."
            highlight
          />
          <StatCard
            label="Leads accepted (recognized)"
            value={formatMoney(leadsRecognized)}
            caption="Σ |LEAD_CHARGE|. Recognized lead revenue. Some may have been funded by promo credit — balances are fungible, so the real-vs-promo split per charge is not tracked."
            highlight
          />
          <StatCard
            label="Gross top-ups (card)"
            value={formatMoney(grossTopup)}
            caption="Σ of all TOPUP transactions — money contractors paid by card, before any refunds."
          />
          <StatCard
            label="Card refunds (to card)"
            value={formatMoney(cardRefundsOut)}
            caption="Σ |CARD_REFUND| — real money sent BACK to contractors' cards via Stripe. Reduces net cash."
          />
          <StatCard
            label="Wallet refunds (internal)"
            value={formatMoney(refundsIssued)}
            caption="Σ REFUND. Wallet credits back to contractors (e.g. bad lead) — NOT real Stripe card refunds."
          />
        </Section>

        <Section title="Promo / internal" subtitle="Not real cash — internal ledger only.">
          <StatCard
            label="Promo credit issued"
            value={formatMoney(promoIssued)}
            caption="Σ PROMO_CREDIT — admin-granted, spendable, NOT real money."
          />
          <StatCard
            label="Admin corrections"
            value={formatMoney(adminCorrections)}
            caption="Σ ADMIN_ADJUST — manual corrections (deduct-only, never mints funds)."
          />
        </Section>

        <Section title="Liability" subtitle="Owed to contractors — not profit.">
          <StatCard
            label="Wallet float (liability)"
            value={formatMoney(walletFloat)}
            caption="Σ of all contractors' current wallet balances — pre-paid money (incl. promo) not yet spent. A liability, not revenue."
          />
        </Section>

        <Section
          title="Stripe balance (live)"
          subtitle="The real platform account — the source of truth for withdrawable cash."
          single={stripeUnavailable}
        >
          {stripeUnavailable ? (
            <div
              style={{
                gridColumn: "1 / -1",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "20px 22px",
                boxShadow: "var(--shadow)",
                font: "400 14px/1.5 'Inter'",
                color: "var(--ink2)",
              }}
            >
              Stripe live data unavailable in mock mode. Set{" "}
              <code
                style={{
                  borderRadius: 6,
                  background: "var(--card2)",
                  padding: "2px 6px",
                  fontFamily: "monospace",
                }}
              >
                STRIPE_MOCK=false
              </code>{" "}
              with valid keys to see the real balance and payouts.
            </div>
          ) : (
            <>
              <StatCard
                label="Available balance"
                value={formatBalance(balance.available)}
                caption="Settled funds available for payout."
                highlight
              />
              <StatCard
                label="Pending balance"
                value={formatBalance(balance.pending)}
                caption="Funds not yet settled."
              />
            </>
          )}
        </Section>

        <div>
          <SectionLabel title="Recent payouts" subtitle="Last 10 automatic payouts to the bank." />
          <div
            style={{
              marginTop: 12,
              overflow: "hidden",
              borderRadius: 18,
              border: "1px solid var(--line)",
              background: "var(--card)",
              boxShadow: "var(--shadow)",
            }}
          >
            {stripeUnavailable ? (
              <p style={{ padding: 24, font: "400 14px/1 'Inter'", color: "var(--ink3)" }}>
                Stripe live data unavailable in mock mode.
              </p>
            ) : payouts.payouts.length === 0 ? (
              <p style={{ padding: 24, font: "400 14px/1 'Inter'", color: "var(--ink3)" }}>
                No payouts yet.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--card2)", borderBottom: "1px solid var(--line)" }}>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Arrival</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.payouts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                        {formatMoney(p.amountCents)}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>{p.status}</td>
                      <td style={{ ...tdStyle, color: "var(--ink2)" }}>
                        {p.arrivalDate
                          ? new Date(p.arrivalDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ background: "var(--sage)", borderRadius: 18, padding: "24px 26px" }}>
          <h2
            style={{
              margin: 0,
              font: "600 12px/1 'Inter'",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--sageFg)",
            }}
          >
            Withdrawals
          </h2>
          <p style={{ margin: "10px 0 0", maxWidth: 640, font: "400 14px/1.6 'Inter'", color: "var(--sageFg)", opacity: 0.9 }}>
            Payouts are handled automatically by Stripe to the company bank account on the account
            payout schedule. There are no in-app withdrawal actions — manage the schedule, bank
            account, and manual payouts from the Stripe Dashboard.
          </p>
          <a
            href={STRIPE_DASHBOARD_PAYOUTS_URL}
            target="_blank"
            rel="noreferrer"
            className="a-gold"
            style={{
              marginTop: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 10,
              background: "var(--gold)",
              padding: "10px 16px",
              font: "600 14px/1 'Inter'",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Open Stripe payouts ↗
          </a>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 20px",
  textAlign: "left",
  font: "600 11px/1 'Inter'",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--ink3)",
};
const tdStyle: React.CSSProperties = {
  padding: "13px 20px",
  font: "400 14px/1 'Inter'",
};

function formatBalance(entries: { amountCents: number; currency: string }[]): string {
  if (entries.length === 0) return formatMoney(0);
  const usd = entries.find((e) => e.currency === "usd");
  if (usd) return formatMoney(usd.amountCents);
  const total = entries.reduce((sum, e) => sum + e.amountCents, 0);
  return formatMoney(total);
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2
        style={{
          margin: 0,
          font: "600 12px/1 'Inter'",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--ink)",
        }}
      >
        {title}
      </h2>
      <p style={{ margin: "4px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>{subtitle}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  single,
  children,
}: {
  title: string;
  subtitle: string;
  single?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel title={title} subtitle={subtitle} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: single ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  highlight,
}: {
  label: string;
  value: string;
  caption?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="a-lift"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        padding: "18px 20px",
        background: highlight ? "var(--sage)" : "var(--card)",
        border: highlight ? "none" : "1px solid var(--line)",
        boxShadow: "var(--shadow)",
      }}
    >
      <p
        style={{
          margin: 0,
          font: "600 11px/1 'Inter'",
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: highlight ? "var(--sageFg)" : "var(--ink3)",
          opacity: highlight ? 0.85 : 1,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "10px 0 0",
          font: `600 ${highlight ? "26px" : "24px"}/1 'Inter'`,
          color: highlight ? "var(--sageFg)" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {caption && (
        <p style={{ margin: "12px 0 0", font: "400 12px/1.5 'Inter'", color: highlight ? "var(--sageFg)" : "var(--ink3)", opacity: highlight ? 0.85 : 1 }}>
          {caption}
        </p>
      )}
    </div>
  );
}
