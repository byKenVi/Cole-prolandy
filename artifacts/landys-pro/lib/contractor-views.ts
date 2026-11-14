import type { Prisma, SuccessFee } from "@prisma/client";
import { buildLeadSummary, feeRateLabelFor, landownerDisplayName, type LeadSummary } from "@/lib/lead-summary";
import { leadDisplayInclude } from "@/lib/resolved-lead";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { SuccessFeeTierRow } from "@/lib/domain/success-fee";

/** Everything a contractor screen needs about one opportunity / job. */

export const matchViewInclude = {
  lead: {
    include: {
      ...leadDisplayInclude,
      attachments: {
        where: { ingestionError: null },
        select: { id: true, originalFilename: true, contentType: true },
        orderBy: { createdAt: "asc" },
      },
    },
  },
  successFee: true,
} satisfies Prisma.LeadMatchInclude;

export type MatchWithView = Prisma.LeadMatchGetPayload<{ include: typeof matchViewInclude }>;

export type StatusTone = "neutral" | "ok" | "warn" | "danger" | "copper";

export type MatchView = {
  id: string;
  leadId: string;
  acceptToken: string;
  summary: LeadSummary;
  feeRateLabel: string | null;
  expiresAt: Date | null;
  direct: boolean;
  maxAccepts: number;
  state:
    | "open"
    | "expired"
    | "declined"
    | "taken"
    | "accepted"
    | "won_waiting_payment"
    | "fee_due"
    | "fee_paid"
    | "lost";
  status: { label: string; tone: StatusTone };
  landowner: { name: string; phone: string | null; phoneDisplay: string | null; email: string };
  photos: Array<{ id: string; name: string; isImage: boolean }>;
  fee: {
    status: SuccessFee["status"];
    amountCents: number;
    finalValueCents: number;
    ratePercentLabel: string;
  } | null;
  finalContractValueCents: number | null;
  acceptedAt: Date | null;
};

function percentLabel(bps: number): string {
  const value = bps / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function stateOf(match: MatchWithView, now: number): MatchView["state"] {
  const fee = match.successFee?.status;
  if (match.status === "ACCEPTED") {
    if (fee === "PAID") return "fee_paid";
    if (fee === "DUE") return "fee_due";
    if (match.jobOutcome === "WON") return "won_waiting_payment";
    if (match.jobOutcome === "LOST") return "lost";
    return "accepted";
  }
  if (match.status === "DECLINED") return "declined";
  if (match.status === "SOLD_OUT") return "taken";
  const expired =
    match.status === "EXPIRED" ||
    match.lead.status === "EXPIRED" ||
    !match.lead.expiresAt ||
    match.lead.expiresAt.getTime() <= now;
  if (expired) return "expired";
  if (match.lead.status === "SOLD_OUT") return "taken";
  return "open";
}

const STATUS: Record<MatchView["state"], { label: string; tone: StatusTone }> = {
  open: { label: "Waiting for your answer", tone: "copper" },
  expired: { label: "Expired", tone: "neutral" },
  declined: { label: "You passed", tone: "neutral" },
  taken: { label: "Taken by other pros", tone: "neutral" },
  accepted: { label: "Accepted - call the homeowner", tone: "ok" },
  won_waiting_payment: { label: "Won - waiting to be paid", tone: "warn" },
  fee_due: { label: "Landy's fee due", tone: "danger" },
  fee_paid: { label: "Done - fee paid", tone: "ok" },
  lost: { label: "Not hired", tone: "neutral" },
};

export async function toMatchView(
  match: MatchWithView,
  tiers: SuccessFeeTierRow[],
  now: number = Date.now(),
): Promise<MatchView> {
  const state = stateOf(match, now);
  const fee = match.successFee;
  return {
    id: match.id,
    leadId: match.leadId,
    acceptToken: match.acceptToken,
    summary: await buildLeadSummary(match.lead),
    feeRateLabel: feeRateLabelFor(tiers, match.lead),
    expiresAt: match.lead.expiresAt,
    direct: match.lead.routingMode === "DIRECT",
    maxAccepts: match.lead.maxPurchases,
    state,
    status: STATUS[state],
    landowner: {
      name: landownerDisplayName(match.lead) === "the homeowner" ? "Homeowner" : landownerDisplayName(match.lead),
      phone: match.lead.landownerPhone,
      phoneDisplay: match.lead.landownerPhone ? formatPhoneForDisplay(match.lead.landownerPhone) : null,
      email: match.lead.landownerEmail,
    },
    photos: match.lead.attachments.map((a) => ({
      id: a.id,
      name: a.originalFilename,
      isImage: a.contentType.startsWith("image/"),
    })),
    fee: fee
      ? {
          status: fee.status,
          amountCents: fee.feeAmountCents,
          finalValueCents: fee.finalValueCents,
          ratePercentLabel: percentLabel(fee.rateBasisPoints),
        }
      : null,
    finalContractValueCents: match.finalContractValueCents,
    acceptedAt: match.acceptedAt,
  };
}

/** "1 day 4 hours" / "3 hours" / "25 minutes" until the request closes. */
export function timeLeft(expiresAt: Date | null, now: number = Date.now()): string | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - now;
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""}${hours ? ` ${hours} hour${hours > 1 ? "s" : ""}` : ""}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  return `${Math.max(1, minutes)} minute${minutes > 1 ? "s" : ""}`;
}

export function photoUrl(view: Pick<MatchView, "leadId" | "acceptToken">, photoId: string, viaToken: boolean): string {
  return viaToken
    ? `/api/accept/${encodeURIComponent(view.acceptToken)}/attachments/${photoId}`
    : `/api/contractor/leads/${view.leadId}/attachments/${photoId}`;
}

/** Load matches for one contractor and turn them into views (newest first). */
export async function loadMatchViews(params: {
  contractorId: string;
  where: Prisma.LeadMatchWhereInput;
  orderBy?: Prisma.LeadMatchOrderByWithRelationInput;
  take?: number;
  skip?: number;
}): Promise<MatchView[]> {
  const { prisma } = await import("@/lib/prisma");
  const { loadSuccessFeeTiers } = await import("@/lib/domain/success-fee");
  const [rows, tiers] = await Promise.all([
    prisma.leadMatch.findMany({
      where: { ...params.where, contractorId: params.contractorId },
      include: matchViewInclude,
      orderBy: params.orderBy ?? { createdAt: "desc" },
      take: params.take,
      skip: params.skip,
    }),
    loadSuccessFeeTiers(prisma),
  ]);
  const now = Date.now();
  return Promise.all(rows.map((row) => toMatchView(row, tiers, now)));
}

/** PENDING matches whose request is still open. */
export function openRequestWhere(now: Date = new Date()): Prisma.LeadMatchWhereInput {
  return {
    status: "PENDING",
    lead: { expiresAt: { gt: now }, status: { in: ["NEW", "DISTRIBUTED"] } },
  };
}
