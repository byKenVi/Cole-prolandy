import { sms, type SendSmsResult } from "@/lib/integrations/sms";
import { email, type SendEmailResult } from "@/lib/integrations/email";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type LeadNotification = {
  contractor: { name: string; email: string; phone: string };
  acceptToken: string;
  projectTypeName: string;
  propertyLocation: string;
  tier: number;
  priceCents: number;
  // Optional identifiers for observability. Callers that have them should pass
  // them so failed sends can be traced back to a specific lead/contractor.
  leadId?: string;
  contractorId?: string;
};

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function acceptLink(acceptToken: string): string {
  return `${appUrl()}/accept/${acceptToken}`;
}

type FailedChannel = {
  channel: "sms" | "email";
  error: string;
};

/**
 * Record a failed notification send so it's observable instead of silently
 * swallowed. Writes an AuditLog row (best-effort) and always console.errors
 * with context. This must never throw — notification bookkeeping cannot be
 * allowed to break lead distribution.
 */
async function recordFailure(n: LeadNotification, failed: FailedChannel): Promise<void> {
  const context = {
    leadId: n.leadId ?? null,
    contractorId: n.contractorId ?? null,
    channel: failed.channel,
    to: failed.channel === "sms" ? n.contractor.phone : n.contractor.email,
    error: failed.error,
  };
  // eslint-disable-next-line no-console
  console.error("[notify] send failed:", context);

  try {
    await prisma.auditLog.create({
      data: {
        actorType: "system",
        action: "NOTIFICATION_FAILED",
        targetType: "Lead",
        targetId: n.leadId ?? null,
        metadata: context,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notify] failed to write AuditLog for send failure:", err);
  }
}

/**
 * Fire the new-lead notifications (SMS + email) for a single matched contractor.
 * Both are mocked by default (log to console).
 *
 * Distribution stays resilient: each channel is sent independently and a failure
 * in one (or an unexpected throw) never breaks the other. Failures are surfaced
 * via recordFailure() rather than being swallowed. notifyNewLead itself never
 * throws.
 */
export async function notifyNewLead(n: LeadNotification): Promise<void> {
  const link = acceptLink(n.acceptToken);
  const price = formatMoney(n.priceCents);
  const smsBody = `Landy's Pro: New ${n.projectTypeName} lead in ${n.propertyLocation} (Tier ${n.tier}) for ${price}. Accept: ${link}`;

  const [smsSettled, emailSettled] = await Promise.allSettled([
    sms.send({ to: n.contractor.phone, body: smsBody }),
    email.send({
      to: n.contractor.email,
      subject: `New lead: ${n.projectTypeName} in ${n.propertyLocation}`,
      text: `A new ${n.projectTypeName} lead is available in ${n.propertyLocation} (Tier ${n.tier}).\nLead price: ${price}.\n\nAccept or pass: ${link}`,
    }),
  ]);

  const failures: FailedChannel[] = [];

  // Providers return structured results and shouldn't throw, but allSettled
  // guards against unexpected throws too — handle both shapes.
  collectFailure(failures, "sms", smsSettled);
  collectFailure(failures, "email", emailSettled);

  for (const failure of failures) {
    await recordFailure(n, failure);
  }
}

function collectFailure(
  failures: FailedChannel[],
  channel: FailedChannel["channel"],
  settled: PromiseSettledResult<SendSmsResult | SendEmailResult>,
): void {
  if (settled.status === "rejected") {
    const error =
      settled.reason instanceof Error
        ? settled.reason.message
        : String(settled.reason);
    failures.push({ channel, error });
    return;
  }
  if (!settled.value.ok) {
    failures.push({ channel, error: settled.value.error });
  }
}
