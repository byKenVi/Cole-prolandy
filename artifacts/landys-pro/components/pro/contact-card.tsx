import { Mail, MessageSquare, Phone } from "lucide-react";
import type { MatchView } from "@/lib/contractor-views";
import { LinkButton } from "./ui";

/** After accepting: the homeowner's contact, one tap to call or text. */
export function ContactCard({ view, showNextSteps = true }: { view: MatchView; showNextSteps?: boolean }) {
  const { landowner, summary } = view;
  const firstName = landowner.name.split(/\s+/)[0] || landowner.name;
  const smsBody = encodeURIComponent(
    `Hi ${firstName}, this is about your ${summary.title.toLowerCase()} request on Landy's. When is a good time to talk?`,
  );

  return (
    <div>
      <p className="pro-small" style={{ margin: "0 0 4px" }}>
        Homeowner
      </p>
      <p className="pro-contact-name">{landowner.name}</p>
      <div className="pro-contact-lines">
        {landowner.phoneDisplay && <div>{landowner.phoneDisplay}</div>}
        <div>{landowner.email}</div>
      </div>

      <div className="pro-btn-row">
        {landowner.phone && (
          <LinkButton href={`tel:${landowner.phone}`} variant="primary" big>
            <Phone size={22} aria-hidden /> Call {firstName}
          </LinkButton>
        )}
        <div className="pro-btn-row pro-btn-row--2">
          {landowner.phone && (
            <LinkButton href={`sms:${landowner.phone}?&body=${smsBody}`} variant="secondary">
              <MessageSquare size={20} aria-hidden /> Text
            </LinkButton>
          )}
          <LinkButton href={`mailto:${landowner.email}`} variant="secondary">
            <Mail size={20} aria-hidden /> Email
          </LinkButton>
        </div>
      </div>

      {showNextSteps && (
        <div style={{ marginTop: 26 }}>
          <h2 className="pro-section-title" style={{ fontSize: 21, marginBottom: 14 }}>
            What happens next
          </h2>
          <ol className="pro-steps">
            <li>
              <span>
                <strong>Call {firstName} today.</strong> Homeowners hire the pro who calls first.
              </span>
            </li>
            <li>
              <span>In a few days we will text you: &ldquo;Did you get the job?&rdquo; Answer with one tap.</span>
            </li>
            <li>
              <span>
                If you got it, you pay Landy&apos;s fee{view.feeRateLabel ? ` (${view.feeRateLabel})` : ""} only after the
                homeowner has paid you. Nothing to pay if you did not get it.
              </span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
