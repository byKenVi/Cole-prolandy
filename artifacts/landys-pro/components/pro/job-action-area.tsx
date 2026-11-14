import { formatMoney } from "@/lib/money";
import { onlinePaymentsAvailable } from "@/lib/integrations/payments";
import type { MatchView } from "@/lib/contractor-views";
import type { SuccessFeeTierRow } from "@/lib/domain/success-fee";
import { AcceptActions, type ActionTarget } from "./accept-actions";
import { ContactCard } from "./contact-card";
import { OutcomeActions, PaidActions, PayFeeButton } from "./job-actions";
import { Facts, Notice } from "./ui";

/** The one thing to do next for this job, depending on where it stands. */
export function JobActionArea({
  view,
  target,
  tiers,
  savedCard,
  allowPayment = true,
}: {
  view: MatchView;
  target: ActionTarget;
  tiers: SuccessFeeTierRow[];
  savedCard?: { brand: string | null; last4: string | null } | null;
  /** False on the accept-link page: its token cannot pay a fee. */
  allowPayment?: boolean;
}) {
  const name = view.landowner.name;
  const portal = target.kind === "portal";

  switch (view.state) {
    case "open":
      return (
        <AcceptActions
          target={target}
          feeRateLabel={view.feeRateLabel}
          maxAccepts={view.maxAccepts}
          direct={view.direct}
        />
      );
    case "accepted":
      return (
        <div className="pro-stack" style={{ gap: 28 }}>
          <ContactCard view={view} showNextSteps={!portal} />
          {portal && (
            <div className="pro-card" style={{ boxShadow: "none", background: "var(--pro-quote)" }}>
              <OutcomeActions target={target} homeownerName={name} tiers={tiers} />
            </div>
          )}
        </div>
      );
    case "won_waiting_payment":
      return (
        <div className="pro-stack" style={{ gap: 24 }}>
          <Notice tone="warn" title="You won this job">
            Final price: {view.finalContractValueCents ? formatMoney(view.finalContractValueCents) : "not given"}.
            Landy&apos;s fee is due only after {name} pays you.
          </Notice>
          {portal && <PaidActions target={target} homeownerName={name} />}
          <ContactCard view={view} showNextSteps={false} />
        </div>
      );
    case "fee_due":
      return (
        <div className="pro-stack" style={{ gap: 20 }}>
          {view.fee && (
            <div>
              <p className="pro-small" style={{ margin: 0 }}>
                Landy&apos;s fee to pay
              </p>
              <p className="pro-money" style={{ margin: "2px 0 12px", fontSize: 44, fontWeight: 600, lineHeight: 1.05 }}>
                {formatMoney(view.fee.amountCents)}
              </p>
              <Facts
                items={[
                  { label: "Final job price", value: formatMoney(view.fee.finalValueCents) },
                  { label: "Fee rate", value: view.fee.ratePercentLabel },
                ]}
              />
            </div>
          )}
          {view.fee && allowPayment && onlinePaymentsAvailable() && (
            <PayFeeButton target={target} amountLabel={formatMoney(view.fee.amountCents)} savedCard={savedCard} />
          )}
          {allowPayment && !onlinePaymentsAvailable() && (
            <Notice title="Online payment opens soon">
              Landy&apos;s will contact you to collect this fee. You do not need to do anything now.
            </Notice>
          )}
          {!allowPayment && (
            <Notice>Pay with the link in our &ldquo;fee is due&rdquo; text or email, or sign in to your account.</Notice>
          )}
          <p className="pro-small" style={{ margin: 0 }}>
            Wrong amount? Reply to our email or call Landy&apos;s before paying and we will fix it.
          </p>
        </div>
      );
    case "fee_paid":
      return (
        <div className="pro-stack" style={{ gap: 24 }}>
          <Notice tone="ok" title="All set">
            You paid Landy&apos;s fee{view.fee ? ` of ${formatMoney(view.fee.amountCents)}` : ""}. Thank you!
          </Notice>
          <ContactCard view={view} showNextSteps={false} />
        </div>
      );
    case "lost":
      return <Notice title="Not hired">You told us {name} did not hire you. There is nothing to pay.</Notice>;
    case "expired":
      return <Notice title="This request has expired">It can no longer be accepted.</Notice>;
    case "declined":
      return <Notice title="You passed on this request">We will keep sending you new requests.</Notice>;
    case "taken":
      return (
        <Notice title="Other pros accepted first">
          This request already has its pros. Tip: the first pros to accept get the job, so answer new requests quickly.
        </Notice>
      );
  }
}
