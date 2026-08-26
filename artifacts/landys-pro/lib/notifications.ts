import { sms, type SendSmsResult } from "@/lib/integrations/sms";
import { email, type SendEmailResult } from "@/lib/integrations/email";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { previewSuccessFeeRate } from "@/lib/domain/success-fee";
import { followUpLink, landownerConfirmLink } from "@/lib/domain/follow-up";

export type LeadNotification = {
  contractor: { name: string; email: string; phone: string };
  acceptToken: string;
  projectTypeName: string;
  propertyLocation: string;
  tier: number;
  /** Estimated job value in cents for success-fee preview. */
  estimatedValueCents?: number | null;
  leadId?: string;
  contractorId?: string;
};

export function acceptLink(acceptToken: string): string {
  return `${appUrl()}/accept/${acceptToken}`;
}

type FailedChannel = {
  channel: "sms" | "email";
  error: string;
};

async function recordFailure(
  context: Record<string, unknown>,
  failed: FailedChannel,
): Promise<void> {
  console.error("[notify] send failed:", { ...context, ...failed });

  try {
    await prisma.auditLog.create({
      data: {
        actorType: "system",
        action: "NOTIFICATION_FAILED",
        targetType: "Lead",
        targetId: (context.leadId as string) ?? null,
        metadata: { ...context, ...failed },
      },
    });
  } catch (err) {
    console.error("[notify] failed to write AuditLog for send failure:", err);
  }
}

function feeRateLabel(ratePercent: number): string {
  const rounded = ratePercent % 1 === 0 ? ratePercent.toFixed(0) : ratePercent.toFixed(1);
  return `${rounded}% success fee if you win`;
}

/**
 * Fire opportunity notifications (SMS + email) for a matched contractor.
 * Never throws — failures are logged.
 */
export async function notifyNewLead(n: LeadNotification): Promise<void> {
  const link = acceptLink(n.acceptToken);
  let feeHint = "Pay only when you get paid.";
  if (n.estimatedValueCents && n.estimatedValueCents > 0) {
    try {
      const { ratePercent } = await previewSuccessFeeRate(prisma, n.estimatedValueCents);
      feeHint = feeRateLabel(ratePercent);
    } catch {
      // Non-fatal — generic copy is fine.
    }
  }

  const smsBody = `Landy's Pro: New ${n.projectTypeName} opportunity near ${n.propertyLocation}. ${feeHint} Accept or pass: ${link}`;
  const emailBody = `A new ${n.projectTypeName} opportunity is available near ${n.propertyLocation}.\n${feeHint}\n\nAccept or pass: ${link}`;

  const [smsSettled, emailSettled] = await Promise.allSettled([
    sms.send({ to: n.contractor.phone, body: smsBody }),
    email.send({
      to: n.contractor.email,
      subject: `New opportunity: ${n.projectTypeName} near ${n.propertyLocation}`,
      text: emailBody,
    }),
  ]);

  const context = {
    leadId: n.leadId ?? null,
    contractorId: n.contractorId ?? null,
  };
  const failures: FailedChannel[] = [];
  collectFailure(failures, "sms", smsSettled);
  collectFailure(failures, "email", emailSettled);
  for (const failure of failures) {
    await recordFailure(context, failure);
  }
}

export async function notifyOutcomeFollowUp(params: {
  contractor: { name: string; email: string; phone: string };
  token: string;
  projectLabel: string;
  location: string;
  leadMatchId: string;
}) {
  const link = followUpLink(params.token);
  const smsBody = `Landy's Pro: Did you get the ${params.projectLabel} job near ${params.location}? Yes or No: ${link}`;
  const emailBody = `Quick check on the ${params.projectLabel} job near ${params.location}.\n\nDid you get this job?\n${link}`;

  await Promise.allSettled([
    sms.send({ to: params.contractor.phone, body: smsBody }),
    email.send({
      to: params.contractor.email,
      subject: `Did you get the job? — ${params.projectLabel}`,
      text: emailBody,
    }),
  ]);
}

export async function notifyPaymentFollowUp(params: {
  contractor: { name: string; email: string; phone: string };
  token: string;
  projectLabel: string;
  leadMatchId: string;
}) {
  const link = followUpLink(params.token);
  const smsBody = `Landy's Pro: Have you been paid for the ${params.projectLabel} job? Yes or Not yet: ${link}`;
  const emailBody = `Have you been paid for the ${params.projectLabel} job?\n\n${link}`;

  await Promise.allSettled([
    sms.send({ to: params.contractor.phone, body: smsBody }),
    email.send({
      to: params.contractor.email,
      subject: `Have you been paid? — ${params.projectLabel}`,
      text: emailBody,
    }),
  ]);
}

export async function notifyFeeDue(params: {
  contractor: { name: string; email: string; phone: string };
  token: string;
  projectLabel: string;
  feeAmountCents: number;
  payLink: string;
}) {
  const amount = (params.feeAmountCents / 100).toFixed(2);
  const smsBody = `Landy's Pro: Your ${params.projectLabel} success fee ($${amount}) is due. Pay Landy's: ${params.payLink}`;
  await Promise.allSettled([
    sms.send({ to: params.contractor.phone, body: smsBody }),
    email.send({
      to: params.contractor.email,
      subject: `Success fee due — ${params.projectLabel}`,
      text: `Your success fee of $${amount} is due.\n\nPay Landy's: ${params.payLink}`,
    }),
  ]);
}

export async function notifyLandownerConfirmation(params: {
  landownerEmail: string;
  landownerName: string | null;
  token: string;
  projectLabel: string;
}) {
  const link = landownerConfirmLink(params.token);
  const name = params.landownerName?.trim() || "there";
  await email.send({
    to: params.landownerEmail,
    subject: `Did you hire a contractor for your ${params.projectLabel} project?`,
    text: `Hi ${name},\n\nDid you hire one of the contractors Landy's connected you with for your ${params.projectLabel} project?\n\n${link}`,
  });
}

function collectFailure(
  failures: FailedChannel[],
  channel: FailedChannel["channel"],
  settled: PromiseSettledResult<SendSmsResult | SendEmailResult>,
): void {
  if (settled.status === "rejected") {
    const error =
      settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
    failures.push({ channel, error });
    return;
  }
  if (!settled.value.ok) {
    failures.push({ channel, error: settled.value.error });
  }
}
