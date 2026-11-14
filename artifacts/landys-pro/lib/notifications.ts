import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { parseAdminEmails } from "@/lib/admin-emails";
import { APP_SETTING_KEYS } from "@/lib/domain/types";
import { loadSuccessFeeTiers } from "@/lib/domain/success-fee";
import { followUpLink, landownerConfirmLink } from "@/lib/domain/follow-up";
import { timeZoneForZip, DEFAULT_TIME_ZONE } from "@/lib/geo/zip";
import { buildLeadSummary, feeRateLabelFor } from "@/lib/lead-summary";
import { leadDisplayInclude } from "@/lib/resolved-lead";
import { formatPhoneForDisplay, normalizePhone } from "@/lib/phone";
import { enqueueAndDispatch, type OutboxMessage } from "@/lib/notify/outbox";
import { onlinePaymentsAvailable } from "@/lib/integrations/payments";
import { nextSmsSendTime } from "@/lib/notify/quiet-hours";
import {
  adminAlertEmail,
  contractorInvitationMessages,
  feeDueMessages,
  landownerContractorAcceptedEmail,
  landownerHireCheckEmail,
  newLeadMessages,
  outcomeCheckMessages,
  paymentCheckMessages,
  type RenderedEmail,
} from "@/lib/notify/templates";

/**
 * High-level notifications. Every function here only ENQUEUES messages in the
 * outbox (lib/notify/outbox.ts) and never throws on delivery problems.
 */

export function acceptLink(acceptToken: string): string {
  return `${appUrl()}/accept/${acceptToken}`;
}

type ContractorContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  smsOptedOutAt?: Date | null;
  serviceZipCodes?: string[];
};

async function contractorMessages(params: {
  contractor: ContractorContact;
  kind: string;
  sms: string;
  email: RenderedEmail;
  leadId?: string | null;
  leadMatchId?: string | null;
  /** Time zone used for SMS quiet hours. */
  timeZone?: string;
}): Promise<OutboxMessage[]> {
  const { contractor } = params;
  const messages: OutboxMessage[] = [];
  const base = {
    kind: params.kind,
    contractorId: contractor.id,
    leadId: params.leadId ?? null,
    leadMatchId: params.leadMatchId ?? null,
  };

  if (contractor.email?.includes("@")) {
    messages.push({
      ...base,
      channel: "email",
      recipient: contractor.email,
      subject: params.email.subject,
      body: params.email.text,
      html: params.email.html,
    });
  }

  const phone = normalizePhone(contractor.phone);
  const timeZone =
    params.timeZone ??
    (contractor.serviceZipCodes?.[0] ? await timeZoneForZip(contractor.serviceZipCodes[0]) : DEFAULT_TIME_ZONE);
  messages.push({
    ...base,
    channel: "sms",
    recipient: phone ?? contractor.phone ?? "",
    body: params.sms,
    sendAfter: nextSmsSendTime(new Date(), timeZone),
    skipReason: contractor.smsOptedOutAt
      ? "Contractor replied STOP (SMS opt-out)."
      : !phone
        ? "No valid mobile number on file."
        : null,
  });
  return messages;
}

const contractorSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  smsOptedOutAt: true,
  serviceZipCodes: true,
  websiteUrl: true,
} as const;

// ─────────────────────────────────────────────────────────────
// New lead → matched contractors
// ─────────────────────────────────────────────────────────────

export async function notifyContractorsOfNewLead(
  leadId: string,
  matchIds: string[],
  options: { photoCount?: number } = {},
): Promise<void> {
  if (matchIds.length === 0) return;
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        ...leadDisplayInclude,
        attachments: { where: { ingestionError: null }, select: { id: true } },
      },
    });
    if (!lead) return;
    const matches = await prisma.leadMatch.findMany({
      where: { id: { in: matchIds }, leadId },
      include: { contractor: { select: contractorSelect } },
    });
    const [summary, tiers, timeZone] = await Promise.all([
      buildLeadSummary(lead),
      loadSuccessFeeTiers(prisma),
      timeZoneForZip(lead.propertyZip ?? lead.propertyLocation),
    ]);
    const feeRateLabel = feeRateLabelFor(tiers, lead);
    const expiresInHours = lead.expiresAt
      ? Math.max(1, Math.round((lead.expiresAt.getTime() - Date.now()) / 3_600_000))
      : 48;

    const messages: OutboxMessage[] = [];
    for (const match of matches) {
      const rendered = newLeadMessages({
        contractorName: match.contractor.name,
        summary,
        link: acceptLink(match.acceptToken),
        feeRateLabel,
        direct: lead.routingMode === "DIRECT",
        maxAccepts: lead.maxPurchases,
        expiresInHours,
        photoCount: Math.max(options.photoCount ?? 0, lead.attachments.length),
      });
      messages.push(
        ...(await contractorMessages({
          contractor: match.contractor,
          kind: "lead.new",
          sms: rendered.sms,
          email: rendered.email,
          leadId,
          leadMatchId: match.id,
          timeZone,
        })),
      );
    }
    await enqueueAndDispatch(messages);
  } catch (error) {
    console.error("[notify] new lead notifications failed", { leadId, error });
  }
}

// ─────────────────────────────────────────────────────────────
// Follow-ups
// ─────────────────────────────────────────────────────────────

async function loadMatchForMessage(leadMatchId: string) {
  return prisma.leadMatch.findUnique({
    where: { id: leadMatchId },
    include: {
      contractor: { select: contractorSelect },
      lead: { include: leadDisplayInclude },
      successFee: true,
    },
  });
}

export async function notifyOutcomeCheck(leadMatchId: string, token: string, attempt: number): Promise<void> {
  const match = await loadMatchForMessage(leadMatchId);
  if (!match) return;
  const summary = await buildLeadSummary(match.lead);
  const rendered = outcomeCheckMessages({
    contractorName: match.contractor.name,
    summary,
    link: followUpLink(token),
    attempt,
  });
  await enqueueAndDispatch(
    await contractorMessages({
      contractor: match.contractor,
      kind: "followup.outcome",
      sms: rendered.sms,
      email: rendered.email,
      leadId: match.leadId,
      leadMatchId,
    }),
  );
}

export async function notifyPaymentCheck(leadMatchId: string, token: string, attempt: number): Promise<void> {
  const match = await loadMatchForMessage(leadMatchId);
  if (!match) return;
  const summary = await buildLeadSummary(match.lead);
  const rendered = paymentCheckMessages({
    contractorName: match.contractor.name,
    summary,
    link: followUpLink(token),
    attempt,
    finalValueCents: match.finalContractValueCents,
  });
  await enqueueAndDispatch(
    await contractorMessages({
      contractor: match.contractor,
      kind: "followup.payment",
      sms: rendered.sms,
      email: rendered.email,
      leadId: match.leadId,
      leadMatchId,
    }),
  );
}

export async function notifyFeeDue(leadMatchId: string, token: string, reminderNumber: number): Promise<void> {
  const match = await loadMatchForMessage(leadMatchId);
  if (!match?.successFee) return;
  const summary = await buildLeadSummary(match.lead);
  const rate = match.successFee.rateBasisPoints / 100;
  const rendered = feeDueMessages({
    contractorName: match.contractor.name,
    summary,
    link: followUpLink(token),
    feeAmountCents: match.successFee.feeAmountCents,
    finalValueCents: match.successFee.finalValueCents,
    ratePercentLabel: `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`,
    reminderNumber,
    canPayOnline: onlinePaymentsAvailable(),
  });
  await enqueueAndDispatch(
    await contractorMessages({
      contractor: match.contractor,
      kind: reminderNumber === 0 ? "fee.due" : "fee.reminder",
      sms: rendered.sms,
      email: rendered.email,
      leadId: match.leadId,
      leadMatchId,
    }),
  );
}

// ─────────────────────────────────────────────────────────────
// Landowner
// ─────────────────────────────────────────────────────────────

export async function notifyLandownerContractorAccepted(leadMatchId: string): Promise<void> {
  try {
    const match = await loadMatchForMessage(leadMatchId);
    if (!match || match.landownerNotifiedAt || !match.lead.landownerEmail?.includes("@")) return;
    const claimed = await prisma.leadMatch.updateMany({
      where: { id: leadMatchId, landownerNotifiedAt: null },
      data: { landownerNotifiedAt: new Date() },
    });
    if (claimed.count === 0) return;
    const summary = await buildLeadSummary(match.lead);
    const rendered = landownerContractorAcceptedEmail({
      summary,
      contractor: {
        name: match.contractor.name,
        phone: formatPhoneForDisplay(match.contractor.phone) || null,
        email: match.contractor.email,
        websiteUrl: match.contractor.websiteUrl,
      },
      maxAccepts: match.lead.maxPurchases,
    });
    await enqueueAndDispatch([
      {
        channel: "email",
        kind: "landowner.contractor_accepted",
        recipient: match.lead.landownerEmail,
        subject: rendered.subject,
        body: rendered.text,
        html: rendered.html,
        leadId: match.leadId,
        leadMatchId,
      },
    ]);
  } catch (error) {
    console.error("[notify] landowner accepted email failed", { leadMatchId, error });
  }
}

export async function notifyLandownerHireCheck(confirmationId: string, reminder: boolean): Promise<boolean> {
  const confirmation = await prisma.landownerConfirmation.findUnique({
    where: { id: confirmationId },
    include: {
      lead: {
        include: {
          ...leadDisplayInclude,
          matches: {
            where: { status: "ACCEPTED" },
            orderBy: { acceptedAt: "asc" },
            select: { id: true, contractor: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!confirmation || !confirmation.lead.landownerEmail?.includes("@")) return false;
  if (confirmation.lead.matches.length === 0) return false;
  const summary = await buildLeadSummary(confirmation.lead);
  const base = landownerConfirmLink(confirmation.token);
  const rendered = landownerHireCheckEmail({
    summary,
    contractors: confirmation.lead.matches.map((m) => ({
      name: m.contractor.name,
      link: `${base}?choice=${encodeURIComponent(m.id)}`,
    })),
    noneLink: `${base}?choice=none`,
    otherLink: `${base}?choice=other`,
    reminder,
  });
  await enqueueAndDispatch([
    {
      channel: "email",
      kind: reminder ? "landowner.hire_check_reminder" : "landowner.hire_check",
      recipient: confirmation.lead.landownerEmail,
      subject: rendered.subject,
      body: rendered.text,
      html: rendered.html,
      leadId: confirmation.leadId,
    },
  ]);
  return true;
}

// ─────────────────────────────────────────────────────────────
// Contractor invitation
// ─────────────────────────────────────────────────────────────

export async function notifyContractorInvitation(params: {
  contractor: ContractorContact;
  signUpLink: string;
}): Promise<void> {
  const tiers = await loadSuccessFeeTiers(prisma);
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  const feeSummary =
    sorted.length > 0
      ? sorted
          .map((tier, i) => {
            const pct = `${tier.rateBasisPoints / 100}%`;
            const prev = sorted[i - 1]?.maxValueCents;
            if (tier.maxValueCents === null) {
              return prev ? `${pct} above $${Math.round(prev / 100).toLocaleString("en-US")}` : pct;
            }
            return `${pct} up to $${Math.round(tier.maxValueCents / 100).toLocaleString("en-US")}`;
          })
          .join(", ") + " of the final job price"
      : "A small percentage of the final job price";
  const rendered = contractorInvitationMessages({
    contractorName: params.contractor.name,
    contractorEmail: params.contractor.email,
    signUpLink: params.signUpLink,
    signInLink: `${appUrl()}/sign-in`,
    feeSummary,
  });
  await enqueueAndDispatch(
    await contractorMessages({
      contractor: params.contractor,
      kind: "contractor.invitation",
      sms: rendered.sms,
      email: rendered.email,
    }),
  );
}

// ─────────────────────────────────────────────────────────────
// Admin alerts
// ─────────────────────────────────────────────────────────────

export async function adminAlertRecipients(): Promise<string[]> {
  const [admins, extra] = await Promise.all([
    prisma.adminUser.findMany({ where: { disabledAt: null }, select: { email: true } }),
    prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.adminAlertEmails } }),
  ]);
  const all = [
    ...admins.map((a) => a.email.toLowerCase()),
    ...parseAdminEmails(process.env.ADMIN_EMAILS),
    ...parseAdminEmails(extra?.value),
  ];
  return [...new Set(all.filter((e) => e.includes("@")))];
}

export async function notifyAdmins(params: {
  kind: string;
  title: string;
  lines: string[];
  link?: { label: string; path: string } | null;
  leadId?: string | null;
  contractorId?: string | null;
}): Promise<void> {
  try {
    const recipients = await adminAlertRecipients();
    if (recipients.length === 0) return;
    const rendered = adminAlertEmail({
      title: params.title,
      lines: params.lines,
      link: params.link ? { label: params.link.label, href: `${appUrl()}${params.link.path}` } : null,
    });
    await enqueueAndDispatch(
      recipients.map((recipient) => ({
        channel: "email" as const,
        kind: `admin.${params.kind}`,
        recipient,
        subject: rendered.subject,
        body: rendered.text,
        html: rendered.html,
        leadId: params.leadId ?? null,
        contractorId: params.contractorId ?? null,
      })),
    );
  } catch (error) {
    console.error("[notify] admin alert failed", { kind: params.kind, error });
  }
}
