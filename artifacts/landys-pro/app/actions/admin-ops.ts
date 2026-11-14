"use server";

import { revalidatePath } from "next/cache";
import { FollowUpAction, JobOutcome, LeadMatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { createFollowUpToken, FOLLOW_UP_STAGES } from "@/lib/domain/follow-up";
import {
  confirmContractorPaid,
  reportJobLost,
  reportJobWon,
  sendFeeDueNotice,
} from "@/lib/domain/job-outcome";
import {
  notifyContractorsOfNewLead,
  notifyLandownerHireCheck,
  notifyOutcomeCheck,
  notifyPaymentCheck,
} from "@/lib/notifications";
import { dispatchPendingNotifications, enqueueNotifications } from "@/lib/notify/outbox";
import { renderEmail, renderEmailText } from "@/lib/notify/email-layout";
import { landysEnvironment } from "@/lib/runtime-environment";
import { normalizePhone } from "@/lib/phone";

type Result = { ok: true; message: string } | { ok: false; message: string };

function fail(error: unknown, fallback: string): Result {
  return { ok: false, message: error instanceof DomainError ? error.message : error instanceof Error ? error.message : fallback };
}

async function audit(actor: string | null, action: string, targetId: string, metadata: Record<string, unknown> = {}) {
  await prisma.auditLog.create({
    data: { actorType: "admin", actorId: actor, action, targetType: "LeadMatch", targetId, metadata: metadata as object },
  });
}

function refresh(leadId: string) {
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/messages");
}

// ─────────────────────────────────────────────────────────────
// Test message: proves Twilio / Resend work, in dev and in production
// ─────────────────────────────────────────────────────────────

export async function sendTestMessageAction(input: { email?: string; phone?: string }): Promise<Result> {
  const admin = await requireAdmin();
  const email = input.email?.trim();
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (!email && !input.phone?.trim()) return { ok: false, message: "Enter an email address, a mobile number, or both." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "That email address does not look right." };
  if (input.phone?.trim() && !phone) return { ok: false, message: "That mobile number does not look right. Use a US number like (512) 555-0100." };

  const content = {
    preheader: "Landy's Pro test message",
    heading: "Test message from Landy's Pro",
    intro: [
      `This email was sent from the admin by ${admin.email ?? "an admin"} to check that email delivery works.`,
      "If you can read it, contractors and homeowners will receive their emails too.",
    ],
    footer: "Automatic test from Landy's Pro.",
  };
  const messages = [];
  if (email) {
    messages.push({
      channel: "email" as const,
      kind: "admin.test",
      recipient: email,
      subject: "Landy's Pro test email",
      body: renderEmailText(content),
      html: renderEmail(content),
    });
  }
  if (phone) {
    messages.push({
      channel: "sms" as const,
      kind: "admin.test",
      recipient: phone,
      body: "Landy's Pro: test text message from the admin. If you got this, job request texts will reach contractors. Reply STOP to opt out.",
    });
  }
  const ids = await enqueueNotifications(prisma, messages);
  await dispatchPendingNotifications({ ids });
  const rows = await prisma.notificationMessage.findMany({
    where: { id: { in: ids } },
    select: { channel: true, status: true, lastError: true },
  });
  const redirected = landysEnvironment() !== "production";
  const parts = rows.map((r) =>
    r.status === "SENT"
      ? `${r.channel === "sms" ? "Text" : "Email"} sent`
      : `${r.channel === "sms" ? "Text" : "Email"} ${r.status.toLowerCase()}${r.lastError ? `: ${r.lastError.slice(0, 160)}` : ""}`,
  );
  const allSent = rows.every((r) => r.status === "SENT");
  revalidatePath("/admin/messages");
  return {
    ok: allSent,
    message:
      parts.join(". ") +
      "." +
      (redirected ? " (Development: messages go to DEVELOPMENT_NOTIFICATION_EMAIL / _PHONE, not the address typed.)" : ""),
  };
}

// ─────────────────────────────────────────────────────────────
// Per-job follow-up tools (testing and customer support)
// ─────────────────────────────────────────────────────────────

async function loadMatch(leadMatchId: string) {
  const match = await prisma.leadMatch.findUnique({
    where: { id: leadMatchId },
    include: { successFee: { select: { status: true, reminderCount: true } } },
  });
  if (!match) throw new Error("Job not found.");
  return match;
}

export async function resendNewLeadAction(leadMatchId: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const match = await loadMatch(leadMatchId);
    if (match.status !== LeadMatchStatus.PENDING) return { ok: false, message: "Only waiting requests can be re-sent." };
    await notifyContractorsOfNewLead(match.leadId, [match.id]);
    await audit(admin.email, "admin.lead.resent", match.id);
    refresh(match.leadId);
    return { ok: true, message: "Job request re-sent by text and email." };
  } catch (error) {
    return fail(error, "Could not re-send the request.");
  }
}

export async function sendOutcomeCheckNowAction(leadMatchId: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const match = await loadMatch(leadMatchId);
    if (match.status !== LeadMatchStatus.ACCEPTED || match.jobOutcome !== JobOutcome.OPEN) {
      return { ok: false, message: "This job already has an outcome." };
    }
    const token = await createFollowUpToken(prisma, { action: FollowUpAction.REPORT_OUTCOME, leadMatchId });
    const attempt = match.followUpAttempts + 1;
    await notifyOutcomeCheck(leadMatchId, token.token, attempt);
    await prisma.leadMatch.update({
      where: { id: leadMatchId },
      data: {
        followUpStage: FOLLOW_UP_STAGES.outcome,
        followUpAttempts: attempt,
        followUpNextAt: new Date(Date.now() + 4 * 86400_000),
      },
    });
    await audit(admin.email, "admin.followup.outcome_sent", leadMatchId);
    refresh(match.leadId);
    return { ok: true, message: "\"Did you get the job?\" sent by text and email." };
  } catch (error) {
    return fail(error, "Could not send the follow-up.");
  }
}

export async function sendPaymentCheckNowAction(leadMatchId: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const match = await loadMatch(leadMatchId);
    if (match.jobOutcome !== JobOutcome.WON || match.successFee?.status !== "AWAITING_CONTRACTOR_PAYMENT") {
      return { ok: false, message: "This job is not waiting for the homeowner's payment." };
    }
    const token = await createFollowUpToken(prisma, { action: FollowUpAction.CONFIRM_PAID, leadMatchId });
    const attempt = match.followUpAttempts + 1;
    await notifyPaymentCheck(leadMatchId, token.token, attempt);
    await prisma.leadMatch.update({
      where: { id: leadMatchId },
      data: {
        followUpStage: FOLLOW_UP_STAGES.payment,
        followUpAttempts: attempt,
        followUpNextAt: new Date(Date.now() + 7 * 86400_000),
      },
    });
    await audit(admin.email, "admin.followup.payment_sent", leadMatchId);
    refresh(match.leadId);
    return { ok: true, message: "\"Have you been paid?\" sent by text and email." };
  } catch (error) {
    return fail(error, "Could not send the follow-up.");
  }
}

export async function resendFeeLinkAction(leadMatchId: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const match = await loadMatch(leadMatchId);
    if (match.successFee?.status !== "DUE") return { ok: false, message: "No fee is due on this job." };
    await sendFeeDueNotice(leadMatchId, Math.max(1, match.successFee.reminderCount));
    await audit(admin.email, "admin.fee.link_resent", leadMatchId);
    refresh(match.leadId);
    return { ok: true, message: "Payment link sent by text and email." };
  } catch (error) {
    return fail(error, "Could not send the payment link.");
  }
}

/** After a phone call: record the outcome on the contractor's behalf. */
export async function recordOutcomeAction(input: {
  leadMatchId: string;
  won: boolean;
  finalValueDollars?: number;
}): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const match = await loadMatch(input.leadMatchId);
    if (input.won) {
      const dollars = Number(input.finalValueDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) return { ok: false, message: "Enter the final job price." };
      await reportJobWon({
        leadMatchId: input.leadMatchId,
        finalContractValueCents: Math.round(dollars * 100),
        actorType: "admin",
        actorId: admin.email,
      });
    } else {
      await reportJobLost({ leadMatchId: input.leadMatchId, actorType: "admin", actorId: admin.email });
    }
    refresh(match.leadId);
    return { ok: true, message: input.won ? "Recorded as won. The payment check is scheduled." : "Recorded as not hired." };
  } catch (error) {
    return fail(error, "Could not record the outcome.");
  }
}

/** After a phone call: the contractor says the homeowner paid them. */
export async function recordContractorPaidAction(leadMatchId: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const match = await loadMatch(leadMatchId);
    await confirmContractorPaid({ leadMatchId, actorType: "admin", actorId: admin.email });
    refresh(match.leadId);
    return { ok: true, message: "Fee is now due. The payment link was sent to the contractor." };
  } catch (error) {
    return fail(error, "Could not update the job.");
  }
}

export async function sendHireCheckNowAction(leadId: string): Promise<Result> {
  const admin = await requireAdmin();
  try {
    const confirmation = await prisma.landownerConfirmation.findUnique({ where: { leadId } });
    if (!confirmation) return { ok: false, message: "No contractor has accepted this request yet." };
    if (confirmation.respondedAt) return { ok: false, message: "The homeowner already answered." };
    const sent = await notifyLandownerHireCheck(confirmation.id, Boolean(confirmation.sentAt));
    if (!sent) return { ok: false, message: "The homeowner has no email address or no pro accepted." };
    await prisma.landownerConfirmation.update({
      where: { id: confirmation.id },
      data: confirmation.sentAt ? { reminderSentAt: new Date() } : { sentAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { actorType: "admin", actorId: admin.email, action: "admin.landowner.hire_check_sent", targetType: "Lead", targetId: leadId },
    });
    refresh(leadId);
    return { ok: true, message: "\"Did you hire someone?\" sent to the homeowner." };
  } catch (error) {
    return fail(error, "Could not send the email.");
  }
}
