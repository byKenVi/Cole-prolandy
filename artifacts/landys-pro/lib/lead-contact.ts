import { LeadMatchStatus } from "@prisma/client";

/** Contact details are visible only after this contractor's match is purchased. */
export function canRevealLeadContact(status: LeadMatchStatus): boolean {
  return status === LeadMatchStatus.ACCEPTED;
}
