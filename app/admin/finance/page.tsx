import { prisma } from "@/lib/prisma";
import { getStripeBalance, listRecentPayouts } from "@/lib/integrations/payments";
import { PageHeader } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const STRIPE_DASHBOARD_PAYOUTS_URL = "https://dashboard.stripe.com/payouts";
const STRIPE_DASHBOARD_SETTINGS_URL = "https://dashboard.stripe.com/settings/payouts";

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
  const [topup, refund, leadCharge, cardRefund, walletAgg, balance, payouts] = await Promise.all([
    sumByType("TOPUP"),
    sumByType("REFUND"),
    sumByType("LEAD_CHARGE"),
    sumByType("CARD_REFUND"),
    prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
    getStripeBalance(),
    listRecentPayouts(),
  ]);

  const cardRefundsOut = Math.abs(cardRefund);
  const netCashCollected = topup + cardRefund;
  const leadsRecognized = Math.abs(leadCharge);
  const walletFloat = walletAgg._sum.walletBalanceCents ?? 0;
  const stripeUnavailable = balance.mocked || payouts.mocked;

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Cash & revenue"
        title="Finance"
        subtitle="Card top-ups, lead revenue, wallet restorations, and Stripe payouts."
      />

      <div
        className="admin-grid-tight"
        style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, margin: "0 0 26px" }}
      >
        <StatCard
          label="Net cash collected"
          value={formatMoney(netCashCollected)}
          caption="Card top-ups minus any refunds to card."
          highlight
        />
        <StatCard
          label="Leads recognized"
          value={formatMoney(leadsRecognized)}
          caption="Revenue when contractors accept leads."
          highlight
        />
        <StatCard
          label="Wallet float"
          value={formatMoney(walletFloat)}
          caption="Prepaid balances still held for contractors."
        />
        <StatCard
          label="Lead restorations"
          value={formatMoney(refund)}
          caption="Lead charges restored to contractor wallets."
        />
        <StatCard
          label="Card refunds out"
          value={formatMoney(cardRefundsOut)}
          caption="Historical money returned to cards (legacy)."
        />
      </div>

      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 26, alignItems: "start" }}
      >
        <div>
          <SectionLabel title="Recent payouts" />
          <div
            style={{
              marginTop: 12,
              overflow: "hidden",
              borderRadius: 16,
              border: "1px solid var(--line)",
              background: "var(--card)",
              boxShadow: "var(--shadow)",
            }}
          >
            {stripeUnavailable ? (
              <p style={{ padding: 20, font: "400 14px/1.5 'Inter'", color: "var(--ink3)" }}>
                Stripe live data unavailable in mock mode.
              </p>
            ) : payouts.payouts.length === 0 ? (
              <p style={{ padding: 20, font: "400 14px/1 'Inter'", color: "var(--ink3)" }}>
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
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 600,
                          color: "var(--ink)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatMoney(p.amountCents)}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--sageFg)" }}>{p.status}</td>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!stripeUnavailable && (
            <StatCard
              label="Stripe available"
              value={formatBalance(balance.available)}
              caption="Settled platform funds ready for payout."
              highlight
            />
          )}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(150deg,var(--green),var(--green2))",
              borderRadius: 16,
              padding: "22px 24px",
              color: "#F1E7D6",
            }}
          >
            <h2
              style={{
                margin: 0,
                font: "600 12px/1 var(--mono)",
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "#B9D0BC",
              }}
            >
              Withdrawals & banking
            </h2>
            <p style={{ margin: "10px 0 0", font: "400 14px/1.6 'Inter'", color: "rgba(241,231,214,.85)" }}>
              Company payouts and bank details are managed in Stripe. Contractor wallets are prepaid
              lead credit — not bank withdrawals.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
              <a
                href={STRIPE_DASHBOARD_PAYOUTS_URL}
                target="_blank"
                rel="noreferrer"
                className="a-gold"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 10,
                  background: "var(--gold)",
                  padding: "10px 16px",
                  font: "600 14px/1 'Inter'",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Payouts ↗
              </a>
              <a
                href={STRIPE_DASHBOARD_SETTINGS_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.12)",
                  border: "1px solid rgba(241,231,214,.25)",
                  padding: "10px 16px",
                  font: "600 14px/1 'Inter'",
                  color: "#F1E7D6",
                  textDecoration: "none",
                }}
              >
                Banking settings ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 20px",
  textAlign: "left",
  font: "600 10px/1 var(--mono)",
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

function SectionLabel({ title }: { title: string }) {
  return (
    <h2
      style={{
        margin: 0,
        font: "600 12px/1 var(--mono)",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "var(--ink)",
      }}
    >
      {title}
    </h2>
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
        boxShadow: highlight ? "none" : "var(--shadow)",
      }}
    >
      <p
        style={{
          margin: 0,
          font: "600 11px/1 var(--mono)",
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
          font: `600 ${highlight ? "26px" : "24px"}/1 var(--display)`,
          color: highlight ? "var(--sageFg)" : "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {caption && (
        <p
          style={{
            margin: "10px 0 0",
            font: "400 12px/1.5 'Inter'",
            color: highlight ? "var(--sageFg)" : "var(--ink3)",
            opacity: highlight ? 0.85 : 1,
          }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
