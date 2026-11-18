import { notFound } from "next/navigation";
import type { MatchView } from "@/lib/contractor-views";
import { JobTicket } from "@/components/pro/job-ticket";
import { OpportunityView } from "@/components/pro/opportunity-view";
import { JobActionArea } from "@/components/pro/job-action-area";
import { ProTabs } from "@/components/pro/nav";
import { OutcomeActions } from "@/components/pro/job-actions";
import { Notice, PageHead, Perforation, Section, Wordmark } from "@/components/pro/ui";

/**
 * DEVELOPMENT-ONLY design review of the contractor screens with fixture data
 * (no database). Returns 404 in production. Open /dev/pro-preview?screen=home
 * (home | request | accepted | fee | followup).
 */
export const dynamic = "force-dynamic";

const TIERS = [
  { sortOrder: 1, maxValueCents: 999_999, rateBasisPoints: 500 },
  { sortOrder: 2, maxValueCents: 2_499_999, rateBasisPoints: 400 },
  { sortOrder: 3, maxValueCents: null, rateBasisPoints: 300 },
];

function fixture(overrides: Partial<MatchView> = {}): MatchView {
  return {
    id: "m1",
    leadId: "l1",
    acceptToken: "tok",
    summary: {
      categoryName: "Roofing",
      workTypeName: "Repair",
      title: "Roofing, repair",
      cityState: "Hemphill, TX",
      place: "Hemphill, TX 75948",
      zip: "75948",
      budgetLabel: "$5,000 to $15,000",
      timelineLabel: "Within 2 weeks",
      urgencyLabel: "High",
      landTypeName: "Residential",
      description:
        "Storm last Tuesday tore off shingles on the back side of the house. Water is coming in over the kitchen. Metal roof would be nice if the price is right.",
      landownerName: "Jordan Lee",
      landownerFirstName: "Jordan",
    },
    feeRateLabel: "4% to 5%",
    expiresAt: new Date(Date.now() + 31 * 3600_000),
    direct: false,
    maxAccepts: 3,
    state: "open",
    status: { label: "Waiting for your answer", tone: "copper" },
    landowner: { name: "Jordan Lee", phone: "+19362426129", phoneDisplay: "(936) 242-6129", email: "jordan.lee@example.com" },
    photos: [],
    fee: null,
    finalContractValueCents: null,
    acceptedAt: null,
    ...overrides,
  };
}

export default async function ProPreview({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const screen = (await searchParams).screen ?? "home";

  const open = fixture();
  const direct = fixture({
    id: "m2",
    direct: true,
    maxAccepts: 1,
    summary: { ...open.summary, title: "Plumbing - Installation", categoryName: "Plumbing", cityState: "Jasper, TX", place: "Jasper, TX 75951", zip: "75951", budgetLabel: "Under $5,000", timelineLabel: "ASAP", description: "Water heater replacement." },
    feeRateLabel: "5%",
    expiresAt: new Date(Date.now() + 5 * 3600_000),
  });
  const feeDue = fixture({
    id: "m3",
    state: "fee_due",
    status: { label: "Landy's fee due", tone: "danger" },
    fee: { status: "DUE", amountCents: 32_000, finalValueCents: 800_000, ratePercentLabel: "4%" },
    finalContractValueCents: 800_000,
  });
  const accepted = fixture({ state: "accepted", status: { label: "Accepted - call the homeowner", tone: "ok" } });

  let content: React.ReactNode;
  if (screen === "request") {
    content = (
      <>
        <PageHead title="New job request near you" intro="Hi Caddo, here are the details. Accepting costs nothing." />
        <OpportunityView view={{ ...open, photos: [{ id: "p1", name: "roof.jpg", isImage: true }] }} viaToken>
          <JobActionArea view={open} target={{ kind: "token", token: "tok" }} tiers={TIERS} allowPayment={false} />
        </OpportunityView>
      </>
    );
  } else if (screen === "accepted") {
    content = (
      <>
        <PageHead title="Accepted. Call the homeowner today." />
        <OpportunityView view={accepted} viaToken>
          <JobActionArea view={accepted} target={{ kind: "token", token: "tok" }} tiers={TIERS} allowPayment={false} />
        </OpportunityView>
      </>
    );
  } else if (screen === "fee") {
    content = (
      <>
        <PageHead title="My job" back={{ href: "#", label: "All my jobs" }} />
        <OpportunityView view={feeDue} viaToken={false}>
          <JobActionArea view={feeDue} target={{ kind: "portal", matchId: "m3" }} tiers={TIERS} />
        </OpportunityView>
      </>
    );
  } else if (screen === "followup") {
    content = (
      <>
        <PageHead title="Did you get the job?" intro="One quick answer helps us close this request." />
        <article className="pro-ticket">
          <div className="pro-ticket-top">
            <div className="pro-ticket-kind">{open.summary.title}</div>
            <p className="pro-ticket-place">{open.summary.cityState}</p>
            <p className="pro-ticket-sub">Homeowner: Jordan Lee</p>
          </div>
          <Perforation />
          <div className="pro-ticket-body" style={{ paddingTop: 10 }}>
            <OutcomeActions target={{ kind: "token", token: "tok" }} homeownerName="Jordan Lee" tiers={TIERS} />
          </div>
        </article>
      </>
    );
  } else {
    content = (
      <>
        <PageHead title="Hello, Caddo Lake Forestry Co" intro="2 new job requests are waiting for your answer." />
        <Notice tone="warn" title="New job requests are paused">Until November 28.</Notice>
        <Section title="Fees to pay" link={{ href: "#", label: "All fees" }}>
          <JobTicket view={feeDue} href="#" />
        </Section>
        <Section title="New job requests" link={{ href: "#", label: "See all" }}>
          <div className="pro-stack">
            <JobTicket view={direct} href="#" />
            <JobTicket view={open} href="#" />
          </div>
        </Section>
      </>
    );
  }

  return (
    <div className="pro pro-shell">
      <div className="pro-main">
        <header className="pro-topbar">
          <Wordmark href={null} />
        </header>
        <main className="pro-content">{content}</main>
      </div>
      <ProTabs counts={{ requests: 2, feesDue: 1 }} />
    </div>
  );
}
