import { sms } from "@/lib/integrations/sms";
import { email } from "@/lib/integrations/email";
import { formatMoney } from "@/lib/money";

export type LeadNotification = {
  contractor: { name: string; email: string; phone: string };
  acceptToken: string;
  projectTypeName: string;
  propertyLocation: string;
  tier: number;
  priceCents: number;
};

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function acceptLink(acceptToken: string): string {
  return `${appUrl()}/accept/${acceptToken}`;
}

/**
 * Fire the new-lead notifications (SMS + email) for a single matched contractor.
 * Both are mocked by default (log to console). Failures are swallowed and logged
 * so one bad channel can't break distribution.
 */
export async function notifyNewLead(n: LeadNotification): Promise<void> {
  const link = acceptLink(n.acceptToken);
  const price = formatMoney(n.priceCents);
  const smsBody = `Landy's Pro: New ${n.projectTypeName} lead in ${n.propertyLocation} (Tier ${n.tier}) for ${price}. Accept: ${link}`;

  const results = await Promise.allSettled([
    sms.send({ to: n.contractor.phone, body: smsBody }),
    email.send({
      to: n.contractor.email,
      subject: `New lead: ${n.projectTypeName} in ${n.propertyLocation}`,
      text: `A new ${n.projectTypeName} lead is available in ${n.propertyLocation} (Tier ${n.tier}).\nLead price: ${price}.\n\nAccept or pass: ${link}`,
    }),
  ]);

  results.forEach((r) => {
    if (r.status === "rejected") {
      // eslint-disable-next-line no-console
      console.error("[notify] channel failed:", r.reason);
    }
  });
}
