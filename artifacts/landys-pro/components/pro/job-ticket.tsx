import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { timeLeft, type MatchView } from "@/lib/contractor-views";
import { Chip, Facts, Perforation, type Fact } from "./ui";

/** One opportunity / job as a work-order ticket in a list. */
export function JobTicket({ view, href }: { view: MatchView; href: string }) {
  const { summary } = view;
  const open = view.state === "open";
  const left = open ? timeLeft(view.expiresAt) : null;

  const facts: Fact[] = [];
  if (summary.budgetLabel) facts.push({ label: "Budget", value: summary.budgetLabel });
  if (summary.timelineLabel) facts.push({ label: "When", value: summary.timelineLabel });
  if (view.fee && view.state === "fee_due") {
    facts.push({ label: "Fee to pay", value: formatMoney(view.fee.amountCents) });
  } else if (view.state !== "open" && view.state !== "expired" && view.state !== "taken") {
    facts.push({ label: "Homeowner", value: view.landowner.name });
  } else if (view.feeRateLabel) {
    facts.push({ label: "Landy's fee", value: `${view.feeRateLabel}, only if you win` });
  }

  const cta =
    view.state === "open"
      ? "See the job"
      : view.state === "fee_due"
        ? "Pay the fee"
        : view.state === "accepted"
          ? "Call or update"
          : "Open";

  return (
    <Link href={href} className={`pro-ticket${view.direct && open ? " pro-ticket--direct" : ""}`}>
      <div className="pro-ticket-top">
        <div className="pro-ticket-kind">
          <span>{summary.title}</span>
          {view.direct && open ? <Chip tone="copper">Asked for you</Chip> : null}
        </div>
        <p className="pro-ticket-place">{summary.cityState ?? summary.place}</p>
        <p className="pro-ticket-sub">
          <MapPin size={16} aria-hidden style={{ verticalAlign: "-2px", marginRight: 4 }} />
          {summary.zip ? `ZIP ${summary.zip}` : summary.place}
        </p>
      </div>
      <Perforation />
      <div className="pro-ticket-body">
        <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Chip tone={view.status.tone}>{view.status.label}</Chip>
          {left && (
            <Chip tone="neutral">
              <Clock size={15} aria-hidden /> {left} left
            </Chip>
          )}
        </div>
        <Facts items={facts} />
        <span className={`pro-btn ${open || view.state === "fee_due" ? "pro-btn--primary" : "pro-btn--secondary"} pro-ticket-cta`}>
          {cta}
        </span>
      </div>
    </Link>
  );
}
