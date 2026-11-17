import type { LeadSummary } from "@/lib/lead-summary";
import { formatMoney } from "@/lib/money";
import { renderEmail, renderEmailText, type EmailContent, type EmailDetail } from "./email-layout";

/**
 * Every message the app sends, in one file, so wording stays consistent.
 *
 * SMS rules:
 *  - plain ASCII only: one non-GSM character (curly quote, "·", "–") switches
 *    the whole SMS to UCS-2 and triples its cost;
 *  - always say who we are ("Landy's Pro:") and how to stop ("Reply STOP").
 */

export type RenderedEmail = { subject: string; text: string; html: string };

const STOP = "Reply STOP to opt out.";

/** Replace characters that would force UCS-2 encoding. */
export function toSmsText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[·•]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function email(content: EmailContent, subject: string): RenderedEmail {
  return { subject, text: renderEmailText(content), html: renderEmail(content) };
}

function leadDetails(summary: LeadSummary, extra: EmailDetail[] = []): EmailDetail[] {
  const rows: EmailDetail[] = [
    { label: "Type of work", value: summary.title },
    { label: "Location", value: summary.place },
  ];
  if (summary.budgetLabel) rows.push({ label: "Budget", value: summary.budgetLabel });
  if (summary.timelineLabel) rows.push({ label: "When", value: summary.timelineLabel });
  if (summary.urgencyLabel) rows.push({ label: "Urgency", value: summary.urgencyLabel });
  if (summary.landTypeName) rows.push({ label: "Property", value: summary.landTypeName });
  return [...rows, ...extra];
}

function where(summary: LeadSummary): string {
  return summary.cityState ?? summary.place;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3).trimEnd()}...`;
}

// ─────────────────────────────────────────────────────────────
// Contractor: new job request
// ─────────────────────────────────────────────────────────────

export function newLeadMessages(params: {
  contractorName: string;
  summary: LeadSummary;
  link: string;
  feeRateLabel: string | null;
  direct: boolean;
  maxAccepts: number;
  expiresInHours: number;
  photoCount: number;
}): { sms: string; email: RenderedEmail } {
  const { summary } = params;
  const fee = params.feeRateLabel
    ? `Free to view. If you win, Landy's fee is ${params.feeRateLabel} of the job, paid after you get paid.`
    : "Free to view. You only pay Landy's a small fee if you win and get paid.";

  const smsParts = [
    params.direct
      ? `Landy's Pro: A homeowner near ${where(summary)} asked YOU for an estimate.`
      : `Landy's Pro: New job request near ${where(summary)}.`,
    `${summary.title}.`,
    summary.budgetLabel ? `Budget: ${summary.budgetLabel}.` : "",
    summary.timelineLabel ? `When: ${summary.timelineLabel}.` : "",
    fee,
    `See details and accept: ${params.link}`,
    STOP,
  ];
  const sms = toSmsText(smsParts.filter(Boolean).join(" "));

  const rule = params.direct
    ? "This homeowner chose you from your landys.co profile. Only you received this request."
    : `Up to ${params.maxAccepts} pros can accept this request. The first ${params.maxAccepts} to accept get the homeowner's name, phone and email.`;

  const content: EmailContent = {
    preheader: `${summary.title} near ${where(summary)}${summary.budgetLabel ? `, ${summary.budgetLabel}` : ""}`,
    heading: params.direct ? "A homeowner asked you for an estimate" : "New job request near you",
    intro: [
      `Hi ${params.contractorName},`,
      params.direct
        ? `A homeowner near ${where(summary)} found you on landys.co and wants an estimate from you.`
        : `A homeowner near ${where(summary)} is looking for a pro. Here are the details:`,
    ],
    details: leadDetails(
      summary,
      params.photoCount > 0
        ? [{ label: "Photos", value: `${params.photoCount} photo${params.photoCount > 1 ? "s" : ""} (visible after you accept)` }]
        : [],
    ),
    quote: summary.description ? { label: "What the homeowner wrote", text: truncate(summary.description, 900) } : null,
    buttons: [{ label: "See the job and accept", href: params.link }],
    notes: [
      rule,
      `This request expires in ${params.expiresInHours} hours.`,
      `How you pay: nothing now. ${fee.replace(/^Free to view\. /, "")}`,
      "Not interested? Open the link and tap \"Pass\" so we stop reminding you.",
    ],
  };

  const subject = params.direct
    ? `A homeowner asked you for an estimate: ${summary.title} near ${where(summary)}`
    : `New job request: ${summary.title} near ${where(summary)}${summary.budgetLabel ? ` (${summary.budgetLabel})` : ""}`;

  return { sms, email: email(content, subject) };
}

// ─────────────────────────────────────────────────────────────
// Contractor: did you get the job?
// ─────────────────────────────────────────────────────────────

export function outcomeCheckMessages(params: {
  contractorName: string;
  summary: LeadSummary;
  link: string;
  attempt: number;
}): { sms: string; email: RenderedEmail } {
  const { summary } = params;
  const reminder = params.attempt > 1 ? "Reminder: " : "";
  const sms = toSmsText(
    `Landy's Pro: ${reminder}Did you get the ${summary.title} job in ${where(summary)} (homeowner: ${summary.landownerName})? Tap to answer, it takes 10 seconds: ${params.link} ${STOP}`,
  );
  const content: EmailContent = {
    preheader: `Quick question about the ${summary.title} job in ${where(summary)}`,
    heading: "Did you get the job?",
    intro: [
      `Hi ${params.contractorName},`,
      `You accepted the ${summary.title} request from ${summary.landownerName} in ${where(summary)}. Did the homeowner hire you?`,
    ],
    details: leadDetails(summary),
    buttons: [{ label: "Answer now (10 seconds)", href: params.link }],
    notes: [
      "If you got the job, tell us the final price you agreed on. Landy's fee is only due after the homeowner pays you.",
      "If you did not get it, just tap \"No\". There is nothing to pay.",
    ],
  };
  return {
    sms,
    email: email(content, `${reminder}Did you get the ${summary.title} job in ${where(summary)}?`),
  };
}

// ─────────────────────────────────────────────────────────────
// Contractor: has the homeowner paid you?
// ─────────────────────────────────────────────────────────────

export function paymentCheckMessages(params: {
  contractorName: string;
  summary: LeadSummary;
  link: string;
  attempt: number;
  finalValueCents: number | null;
}): { sms: string; email: RenderedEmail } {
  const { summary } = params;
  const reminder = params.attempt > 1 ? "Reminder: " : "";
  const sms = toSmsText(
    `Landy's Pro: ${reminder}Has ${summary.landownerName} paid you for the ${summary.title} job in ${where(summary)}? Tap "Yes" or "Not yet": ${params.link} ${STOP}`,
  );
  const content: EmailContent = {
    preheader: `Has ${summary.landownerName} paid you?`,
    heading: "Has the homeowner paid you?",
    intro: [
      `Hi ${params.contractorName},`,
      `You told us you won the ${summary.title} job in ${where(summary)}${params.finalValueCents ? ` for ${formatMoney(params.finalValueCents)}` : ""}. Has ${summary.landownerName} paid you yet?`,
    ],
    buttons: [{ label: "Answer now", href: params.link }],
    notes: [
      "Tap \"Yes\" once you have been paid. We will then send you a secure link to pay Landy's success fee.",
      "Tap \"Not yet\" and we will check back with you later. Nothing is due until you are paid.",
    ],
  };
  return { sms, email: email(content, `${reminder}Has the homeowner paid you for the ${summary.title} job?`) };
}

// ─────────────────────────────────────────────────────────────
// Contractor: success fee due
// ─────────────────────────────────────────────────────────────

export function feeDueMessages(params: {
  contractorName: string;
  summary: LeadSummary;
  link: string;
  feeAmountCents: number;
  finalValueCents: number;
  ratePercentLabel: string;
  reminderNumber: number;
  /** False while online card payment is not activated yet. */
  canPayOnline?: boolean;
}): { sms: string; email: RenderedEmail } {
  const { summary } = params;
  const amount = formatMoney(params.feeAmountCents);
  const online = params.canPayOnline !== false;
  const prefix =
    params.reminderNumber === 0 ? "" : params.reminderNumber >= 3 ? "Final reminder: " : "Reminder: ";
  const sms = toSmsText(
    online
      ? `Landy's Pro: ${prefix}Your success fee for the ${summary.title} job in ${where(summary)} is due: ${amount} (${params.ratePercentLabel} of ${formatMoney(params.finalValueCents)}). Pay securely by card in 1 minute: ${params.link} ${STOP}`
      : `Landy's Pro: ${prefix}Your success fee for the ${summary.title} job in ${where(summary)} is ${amount} (${params.ratePercentLabel} of ${formatMoney(params.finalValueCents)}). Landy's will contact you to collect it. Details: ${params.link} ${STOP}`,
  );
  const content: EmailContent = {
    preheader: `${amount} success fee for the ${summary.title} job`,
    heading: params.reminderNumber === 0 ? "Your Landy's success fee is ready to pay" : "Your Landy's success fee is still due",
    intro: [
      `Hi ${params.contractorName},`,
      `Congratulations on the ${summary.title} job in ${where(summary)}. Since the homeowner has paid you, Landy's success fee is now due.`,
    ],
    details: [
      { label: "Job", value: `${summary.title}, ${summary.place}` },
      { label: "Homeowner", value: summary.landownerName },
      { label: "Final job price", value: formatMoney(params.finalValueCents) },
      { label: "Landy's fee", value: `${amount} (${params.ratePercentLabel})` },
    ],
    buttons: [{ label: online ? `Pay ${amount} now` : "See the details", href: params.link }],
    notes: [
      online
        ? "Payment is by card through Stripe, our secure payment provider. You do not need to log in."
        : "Online card payment opens soon. Landy's will contact you to collect this fee.",
      "Something is wrong with this amount? Reply to this email before paying and we will fix it.",
    ],
  };
  return { sms, email: email(content, `${prefix}Landy's success fee due: ${amount} for ${summary.title}`) };
}

// ─────────────────────────────────────────────────────────────
// Landowner
// ─────────────────────────────────────────────────────────────

export function landownerContractorAcceptedEmail(params: {
  summary: LeadSummary;
  contractor: { name: string; phone: string | null; email: string | null; websiteUrl: string | null };
  maxAccepts: number;
}): RenderedEmail {
  const { summary, contractor } = params;
  const details: EmailDetail[] = [{ label: "Company", value: contractor.name }];
  if (contractor.phone) details.push({ label: "Phone", value: contractor.phone });
  if (contractor.email) details.push({ label: "Email", value: contractor.email });
  if (contractor.websiteUrl) details.push({ label: "Website", value: contractor.websiteUrl });
  const content: EmailContent = {
    preheader: `${contractor.name} will contact you about your ${summary.title} project`,
    heading: `${contractor.name} wants to help with your project`,
    intro: [
      `Hi ${summary.landownerFirstName},`,
      `Good news: ${contractor.name} received your ${summary.title} request for ${summary.place} through Landy's and would like to give you an estimate. They will contact you soon.`,
      "You can also reach them directly:",
    ],
    details,
    notes: [
      params.maxAccepts > 1
        ? `Up to ${params.maxAccepts} pros can respond to your request. We will email you each time one does.`
        : "This pro is the one you asked for on landys.co.",
      "Landy's never charges homeowners. You agree on the price directly with the pro.",
    ],
    footer: "You are receiving this because you requested an estimate on landys.co. Questions? Just reply to this email.",
  };
  return {
    subject: `${contractor.name} will contact you about your ${summary.title} project`,
    text: renderEmailText(content),
    html: renderEmail(content),
  };
}

export function landownerHireCheckEmail(params: {
  summary: LeadSummary;
  contractors: Array<{ name: string; link: string }>;
  noneLink: string;
  otherLink: string;
  reminder: boolean;
}): RenderedEmail {
  const { summary } = params;
  const content: EmailContent = {
    preheader: "One quick question about your project - one tap",
    heading: `Did you hire someone for your ${summary.title} project?`,
    intro: [
      `Hi ${summary.landownerFirstName},`,
      `A few days ago you asked for estimates for your ${summary.title} project in ${where(summary)}. Did you hire one of these pros? Tap the answer that fits.`,
    ],
    buttons: [
      ...params.contractors.map((c) => ({ label: `I hired ${c.name}`, href: c.link })),
      { label: "I have not hired anyone yet", href: params.noneLink, tone: "secondary" as const },
      { label: "I hired someone else", href: params.otherLink, tone: "secondary" as const },
    ],
    notes: [
      "Your answer helps us keep only reliable pros on Landy's. It takes one tap and it is confidential.",
    ],
    footer: "You are receiving this because you requested an estimate on landys.co. Questions? Just reply to this email.",
  };
  const prefix = params.reminder ? "Reminder: " : "";
  return {
    subject: `${prefix}Did you hire someone for your ${summary.title} project?`,
    text: renderEmailText(content),
    html: renderEmail(content),
  };
}

// ─────────────────────────────────────────────────────────────
// Contractor account invitation
// ─────────────────────────────────────────────────────────────

export function contractorInvitationMessages(params: {
  contractorName: string;
  contractorEmail: string;
  signUpLink: string;
  signInLink: string;
  feeSummary: string;
}): { sms: string; email: RenderedEmail } {
  const sms = toSmsText(
    `Landy's Pro: Hi ${params.contractorName}, Landy's (landys.co) sends you job requests from homeowners near you. Free to receive. Create your free account: ${params.signUpLink} ${STOP}`,
  );
  const content: EmailContent = {
    preheader: "Get job requests from homeowners near you - free to receive",
    heading: "Your Landy's Pro account is ready",
    intro: [
      `Hi ${params.contractorName},`,
      "You are listed as a pro on landys.co. When a homeowner near you asks for an estimate, Landy's sends you the request by text and email.",
      "Your free account lets you see every request, the homeowner's contact details once you accept, and all your jobs in one place.",
    ],
    details: [
      { label: "Cost to receive requests", value: "Free" },
      { label: "When you pay", value: "Only when you win a job and the homeowner has paid you" },
      { label: "Landy's fee", value: params.feeSummary },
      { label: "Sign up with this email", value: params.contractorEmail },
    ],
    buttons: [
      { label: "Create my free account", href: params.signUpLink },
      { label: "I already have an account - sign in", href: params.signInLink, tone: "secondary" },
    ],
    notes: [
      "It takes about 2 minutes. You can keep accepting requests from the text messages even before you sign up.",
      "Landy's sends job requests and follow-ups by text and email. Message and data rates may apply. Reply STOP to any text to stop texts.",
    ],
  };
  return { sms, email: email(content, `${params.contractorName}, your Landy's Pro account is ready`) };
}

// ─────────────────────────────────────────────────────────────
// Admin alert
// ─────────────────────────────────────────────────────────────

export function adminAlertEmail(params: {
  title: string;
  lines: string[];
  link?: { label: string; href: string } | null;
}): RenderedEmail {
  const content: EmailContent = {
    preheader: params.title,
    heading: params.title,
    intro: params.lines,
    buttons: params.link ? [{ label: params.link.label, href: params.link.href }] : [],
    footer: "Automatic alert from Landy's Pro.",
  };
  return {
    subject: `[Landy's Pro] ${params.title}`,
    text: renderEmailText(content),
    html: renderEmail(content),
  };
}
