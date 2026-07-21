import { prisma } from "@/lib/prisma";
import { getStripeBalance, listRecentPayouts } from "@/lib/integrations/payments";
import { PageHeader } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import {
  cashHeldForContractorsCents,
  computeSafeToWithdraw,
  estimateStripeFeesCents,
  netLeadRevenueCents,
  stripeUsdCents,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

const STRIPE_DASHBOARD_PAYOUTS_URL = "https://dashboard.stripe.com/payouts";
const STRIPE_DASHBOARD_SETTINGS_URL = "https://dashboard.stripe.com/settings/payouts";

/** Σ amountCents for a given WalletTransaction type. */
async function sumByType(
  type: "TOPUP" | "CARD_REFUND" | "LEAD_CHARGE" | "REFUND" | "PROMO_CREDIT",
) {
  const agg = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: { type },
  });
  return agg._sum.amountCents ?? 0;
}

export default async function AdminFinance() {
  const [
    topup,
    topupCount,
    cardRefund,
    leadCharge,
    leadRefund,
    paidAccepts,
    refundCount,
    walletAgg,
    balance,
    payouts,
  ] = await Promise.all([
    sumByType("TOPUP"),
    prisma.walletTransaction.count({ where: { type: "TOPUP" } }),
    sumByType("CARD_REFUND"),
    sumByType("LEAD_CHARGE"),
    sumByType("REFUND"),
    // Paid accepts only (seed accepts with no charge are excluded).
    prisma.walletTransaction.count({ where: { type: "LEAD_CHARGE" } }),
    prisma.walletTransaction.count({ where: { type: "REFUND" } }),
    prisma.contractor.aggregate({ _sum: { walletBalanceCents: true } }),
    getStripeBalance(),
    listRecentPayouts(),
  ]);

  const leadRevenue = netLeadRevenueCents(leadCharge, leadRefund);
  const cardRefundsOut = Math.abs(cardRefund);
  const prepaidOnCards = topup + cardRefund;
  const walletSum = Math.max(0, walletAgg._sum.walletBalanceCents ?? 0);
  const heldForContractors = cashHeldForContractorsCents(walletSum);
  const estFees = estimateStripeFeesCents(topup, topupCount);
  const stripeMocked = balance.mocked || payouts.mocked;
  const stripeProviderUnavailable = stripeMocked || Boolean(balance.error || payouts.error);
  const stripeAvailableCents = stripeProviderUnavailable ? null : stripeUsdCents(balance.available);
  const stripePendingCents = stripeProviderUnavailable ? null : stripeUsdCents(balance.pending);
  const stripeCurrencyUnsupported =
    !stripeProviderUnavailable &&
    (stripeAvailableCents === null || stripePendingCents === null);
  const stripeUnavailable =
    stripeProviderUnavailable || stripeAvailableCents === null || stripePendingCents === null;
  const { safeToWithdrawCents, safeAfterPendingCents, uncoveredLiabilityCents } =
    computeSafeToWithdraw({
      netLeadRevenueCents: leadRevenue,
      heldForContractorsCents: heldForContractors,
      stripeAvailableCents,
      stripePendingCents,
    });

  const stripeAvailLabel =
    stripeUnavailable || stripeAvailableCents === null
      ? "—"
      : formatMoney(stripeAvailableCents);
  const stripePendLabel =
    stripeUnavailable || stripePendingCents === null
      ? "—"
      : formatMoney(stripePendingCents);
  const safeNowLabel =
    safeToWithdrawCents === null ? "—" : formatMoney(safeToWithdrawCents);
  const equationParts =
    stripeAvailableCents !== null
      ? `${formatMoney(stripeAvailableCents)} in Stripe − ${formatMoney(heldForContractors)} wallet reserve`
      : null;

  return (
    <div className="admin-fade-up">
      <PageHeader
        kicker="Revenue & cash"
        title="Finance"
        subtitle="You earn when contractors buy leads. Card top-ups are prepaid credit — leave that amount in Stripe. Only Safe to withdraw is yours to pay out."
      />

      <div
        className="admin-grid-tight"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 14,
          marginBottom: 26,
        }}
      >
        <StatCard
          label="Lead revenue (earned)"
          value={formatMoney(leadRevenue)}
          caption={`From ${paidAccepts} paid accept${paidAccepts === 1 ? "" : "s"}${
            refundCount > 0 ? `, ${refundCount} refunded` : ""
          }. What your business made — not always all still in Stripe.`}
          large
        />
        <StatCard
          label="Safe to withdraw (now)"
          value={safeNowLabel}
          caption={
            safeAfterPendingCents !== null &&
            safeToWithdrawCents !== null &&
            safeAfterPendingCents > safeToWithdrawCents
              ? `Pay yourself at most this amount in Stripe. After pending settles: ~${formatMoney(safeAfterPendingCents)}.`
              : equationParts
                ? `Pay yourself at most this amount. ${equationParts} (capped by lead revenue).`
                : "Pay yourself at most this amount in Stripe. Leave wallet reserve covered."
          }
          highlight
          large
        />
      </div>

      <SectionLabel title="How that number is built" />
      <p
        style={{
          margin: "8px 0 12px",
          font: "400 13px/1.5 'Inter'",
          color: "var(--ink3)",
          maxWidth: 640,
        }}
      >
        Stripe mixes prepaid wallets and your revenue in one balance. A payout of the full
        Stripe available would also remove money still owed on contractor wallets.
      </p>
      <div
        className="admin-grid-tight"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 14,
          margin: "0 0 14px",
        }}
      >
        <StatCard
          label="In Stripe (available)"
          value={stripeAvailLabel}
          caption={
            stripeUnavailable
              ? stripeMocked
                ? "Live Stripe balance unavailable in mock mode."
                : stripeCurrencyUnsupported
                  ? "No USD balance was returned. Currencies are never combined."
                  : "Stripe could not be reached. No payout amount is shown."
              : "Cash Stripe shows as ready — prepaid + earned mixed. Not “all yours.”"
          }
        />
        <StatCard
          label="Wallet reserve"
          value={formatMoney(heldForContractors)}
          caption="Conservative reserve for every dollar currently shown in contractor wallets."
        />
        <StatCard
          label="In Stripe (pending)"
          value={stripePendLabel}
          caption="Settling into available — not payout-ready yet."
        />
      </div>
      {uncoveredLiabilityCents > 0 && (
        <p
          style={{
            margin: "0 0 26px",
            font: "500 13px/1.5 'Inter'",
            color: "var(--ink)",
            maxWidth: 640,
          }}
        >
          Wallet balances exceed Stripe cash (available + pending) by{" "}
          {formatMoney(uncoveredLiabilityCents)}. Avoid further payouts until cards settle or
          wallets are spent.
        </p>
      )}
      {uncoveredLiabilityCents === 0 && <div style={{ marginBottom: 26 }} />}

      <SectionLabel title="Card activity (lifetime)" />
      <p
        style={{
          margin: "8px 0 12px",
          font: "400 13px/1.5 'Inter'",
          color: "var(--ink3)",
          maxWidth: 640,
        }}
      >
        Historical charges — not the current wallet reserve above. Net prepaid credit bought
        equals top-ups minus card refunds
        {cardRefundsOut === 0 ? " (same as top-ups while refunds are $0)" : ""}.
      </p>
      <div
        className="admin-grid-tight"
        style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, margin: "0 0 26px" }}
      >
        <StatCard
          label="Card top-ups"
          value={formatMoney(topup)}
          caption="Lifetime charged to contractor cards."
        />
        <StatCard
          label="Card refunds"
          value={formatMoney(cardRefundsOut)}
          caption="Lifetime returned to contractor cards."
        />
        <StatCard
          label="Net prepaid bought"
          value={formatMoney(prepaidOnCards)}
          caption={`Top-ups − refunds. Est. fees ~${formatMoney(estFees)} (≈2.9% + $0.30 × ${topupCount}). Not a payout amount.`}
        />
      </div>

      <div
        className="admin-grid-stack"
        style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 26, alignItems: "start" }}
      >
        <div>
          <SectionLabel title="Recent bank payouts" />
          {!stripeUnavailable && (
            <p
              style={{
                margin: "8px 0 0",
                font: "400 13px/1.5 'Inter'",
                color: "var(--ink3)",
              }}
            >
              Paid / in transit (last 100):{" "}
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {formatMoney(payouts.totalPaidOutCents)}
              </span>
            </p>
          )}
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
                {stripeMocked
                  ? "Stripe live data unavailable in mock mode."
                  : stripeCurrencyUnsupported
                    ? "No USD balance was returned. Currencies are never combined."
                    : "Stripe could not be reached. Try again before making a payout."}
              </p>
            ) : payouts.payouts.length === 0 ? (
              <p style={{ padding: 20, font: "400 14px/1 'Inter'", color: "var(--ink3)" }}>
                No payouts yet.
              </p>
            ) : (
              <>
                <table className="admin-table-desktop" style={{ width: "100%", borderCollapse: "collapse" }}>
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
                <div className="admin-table-mobile" style={{ display: "none", flexDirection: "column" }}>
                  {payouts.payouts.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        padding: "14px 18px",
                        borderBottom: "1px solid var(--line2)",
                      }}
                    >
                      <span style={{ font: "600 16px/1 var(--display)", color: "var(--ink)" }}>
                        {formatMoney(p.amountCents)}
                      </span>
                      <span style={{ font: "500 13px/1 'Inter'", color: "var(--sageFg)" }}>{p.status}</span>
                      <span style={{ font: "400 13px/1 'Inter'", color: "var(--ink2)" }}>
                        {p.arrivalDate
                          ? new Date(p.arrivalDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              In Stripe, pay out at most <strong>Safe to withdraw</strong> — not the full available
              balance. Leave the wallet reserve covered. Bank details stay in Stripe.
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
  large,
}: {
  label: string;
  value: string;
  caption?: string;
  highlight?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className="a-lift"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        padding: large ? "22px 24px" : "18px 20px",
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
          font: `600 ${large ? "34px" : highlight ? "26px" : "24px"}/1 var(--display)`,
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
            maxWidth: large ? 520 : undefined,
          }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
