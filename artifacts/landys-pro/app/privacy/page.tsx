import { PublicFrame } from "@/components/pro/shell";
import { PageHead, Section } from "@/components/pro/ui";

export const metadata = { title: "Privacy and text messages - Landy's Pro" };

/**
 * Privacy notice for Landy's Pro, including the SMS terms carriers require for
 * A2P 10DLC / toll-free registration. Have the client's counsel review it.
 */
export default function PrivacyPage() {
  return (
    <PublicFrame>
      <PageHead
        title="Privacy and text messages"
        intro="How Landy's Pro uses the information of contractors and homeowners, and how our text messages work."
      />

      <Section title="What we collect">
        <div className="pro-card">
          <ul style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 8 }}>
            <li>Contractors: business name, email, mobile number, service area and trades, as listed on landys.co.</li>
            <li>Homeowners: the estimate request sent from landys.co (name, contact details, ZIP code, project details and photos).</li>
            <li>Jobs: which contractor accepted a request, whether they were hired, the final price, and success-fee payments.</li>
          </ul>
        </div>
      </Section>

      <Section title="How we use it">
        <div className="pro-card">
          <p style={{ marginTop: 0 }}>
            We use this information only to connect homeowners with nearby contractors, follow up on jobs, and collect
            Landy&apos;s success fee. A homeowner&apos;s contact details are shared only with the contractors who accept
            their request.
          </p>
          <p style={{ marginBottom: 0 }}>
            We do not sell personal information. Card payments are processed by Stripe; Landy&apos;s never sees card
            numbers.
          </p>
        </div>
      </Section>

      <Section title="Text messages (SMS)">
        <div className="pro-card">
          <p style={{ marginTop: 0 }}>
            Contractors listed on landys.co receive text messages about new job requests near them and follow-ups on
            jobs they accepted (for example &ldquo;Did you get the job?&rdquo; and payment reminders). Message frequency
            varies with the number of requests in your area. Message and data rates may apply.
          </p>
          <ul style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 8 }}>
            <li>Reply <strong>STOP</strong> to any message to stop texts. You will still get emails.</li>
            <li>Reply <strong>HELP</strong> for help, or reply to any Landy&apos;s Pro email.</li>
            <li>We only text between 8 am and 9 pm, local time.</li>
            <li>
              Mobile numbers and text-message consent are never shared with third parties or affiliates for marketing
              purposes.
            </li>
          </ul>
        </div>
      </Section>

      <Section title="Questions or deletion requests">
        <div className="pro-card">
          <p style={{ margin: 0 }}>
            Reply to any Landy&apos;s Pro email to ask a question, correct your information, or ask us to delete it.
          </p>
        </div>
      </Section>
    </PublicFrame>
  );
}
