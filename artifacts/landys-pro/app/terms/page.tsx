import { prisma } from "@/lib/prisma";
import { loadSuccessFeeTiers } from "@/lib/domain/success-fee";
import { SUCCESS_FEE_TERMS_VERSION } from "@/lib/terms";
import { PublicFrame } from "@/components/pro/shell";
import { PageHead, Section } from "@/components/pro/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "How the success fee works",
  description:
    "Receiving and accepting job requests on Landy's Pro is free. Contractors pay a small success fee only when a homeowner hires them and has paid them.",
  alternates: { canonical: "/terms" },
};

/**
 * Plain-language success-fee terms shown next to every Accept button.
 * Rates are read live from the admin settings. Have the client's counsel
 * review this text; bump SUCCESS_FEE_TERMS_VERSION whenever it changes.
 */
export default async function TermsPage() {
  const tiers = (await loadSuccessFeeTiers(prisma)).sort((a, b) => a.sortOrder - b.sortOrder);
  const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  const rows = tiers.map((tier, i) => {
    const from = i === 0 ? null : (tiers[i - 1].maxValueCents ?? 0) + 1;
    const to = tier.maxValueCents === null ? null : tier.maxValueCents + 1;
    const range =
      from === null && to === null
        ? "Any job price"
        : from === null
          ? `Jobs under ${usd(to!)}`
          : to === null
            ? `Jobs of ${usd(from)} and more`
            : `Jobs from ${usd(from)} to under ${usd(to)}`;
    return { range, rate: `${tier.rateBasisPoints / 100}%` };
  });

  return (
    <PublicFrame>
      <PageHead
        title="How Landy's success fee works"
        intro="Receiving and accepting job requests is free. You pay Landy's only when a homeowner from Landy's hires you and has paid you."
      />

      <Section title="The fee">
        <div className="pro-card" style={{ padding: 0 }}>
          {rows.map((row) => (
            <div
              key={row.range}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderTop: "1px solid var(--pro-line)" }}
            >
              <span>{row.range}</span>
              <strong className="pro-money" style={{ fontSize: 20 }}>{row.rate}</strong>
            </div>
          ))}
        </div>
        <p className="pro-small">The rate is set when you report the job as won, using the final price you agreed on with the homeowner.</p>
      </Section>

      <Section title="Step by step">
        <ol className="pro-steps">
          <li><span>You accept a job request. This is free and gives you the homeowner&apos;s contact.</span></li>
          <li><span>A few days later we ask if you got the job. If not, there is nothing to pay.</span></li>
          <li><span>If you got it, you tell us the final price. We then ask when the homeowner has paid you.</span></li>
          <li><span>Once you confirm you were paid, we send you a secure card payment link for Landy&apos;s fee.</span></li>
        </ol>
      </Section>

      <Section title="Your commitments">
        <div className="pro-card">
          <p style={{ marginTop: 0 }}>By accepting a job request you agree to:</p>
          <ul style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 8 }}>
            <li>answer our follow-up questions honestly, including the final job price;</li>
            <li>pay Landy&apos;s fee within 14 days after the homeowner has paid you;</li>
            <li>contact homeowners only about the job they requested.</li>
          </ul>
          <p className="pro-small" style={{ marginBottom: 0 }}>
            We may also ask homeowners which pro they hired. If answers do not match, Landy&apos;s will contact you
            before any fee decision.
          </p>
        </div>
      </Section>

      <p className="pro-small" style={{ marginTop: 32 }}>
        Version {SUCCESS_FEE_TERMS_VERSION}. Questions? Reply to any Landy&apos;s Pro email. See also{" "}
        <a href="/privacy" className="pro-link" style={{ display: "inline", minHeight: 0, fontSize: 16 }}>
          privacy and text messages
        </a>
        .
      </p>
    </PublicFrame>
  );
}
