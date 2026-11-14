import { FollowUpAction, JobOutcome, LeadMatchStatus, LeadStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_SETTING_KEYS } from "@/lib/domain/types";
import { expireLeads } from "@/lib/domain/leads";
import { getFollowUpMaxAttempts } from "@/lib/domain/settings";
import { createFollowUpToken, FOLLOW_UP_STAGES } from "@/lib/domain/follow-up";
import { sendFeeDueNotice } from "@/lib/domain/job-outcome";
import {
  notifyAdmins,
  notifyLandownerHireCheck,
  notifyOutcomeCheck,
  notifyPaymentCheck,
} from "@/lib/notifications";
import { dispatchPendingNotifications } from "@/lib/notify/outbox";
import { processInvitationQueue } from "@/lib/services/contractor-invites";

/**
 * Everything time-based, run by ONE protected endpoint (/api/cron/run) that an
 * external scheduler (cron-job.org) calls every 10 minutes. Each step is
 * idempotent and isolated: one failing step never blocks the others.
 */

const DAY = 24 * 3600 * 1000;
/** Days between follow-up reminders: after the 1st message, after the 2nd, ... */
const FOLLOW_UP_GAPS_DAYS = [4, 7, 7];
/** Fee reminders, in days after the fee became due. Then the admin is alerted. */
const FEE_REMINDER_DAYS = [3, 7, 14];
const FEE_OVERDUE_ALERT_DAYS = 21;
const LANDOWNER_REMINDER_DAYS = 7;
const WIX_SYNC_INTERVAL_HOURS = 6;
const LOCK_MINUTES = 10;

type StepResult = Record<string, unknown> | { error: string };

async function step(name: string, fn: () => Promise<Record<string, unknown>>): Promise<[string, StepResult]> {
  try {
    return [name, await fn()];
  } catch (error) {
    console.error(`[cron] step ${name} failed`, error);
    return [name, { error: error instanceof Error ? error.message : String(error) }];
  }
}

async function acquireLock(now: Date): Promise<boolean> {
  const key = APP_SETTING_KEYS.cronLockUntil;
  const until = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
  try {
    await prisma.appSetting.create({ data: { key, value: until } });
    return true;
  } catch {
    const res = await prisma.appSetting.updateMany({
      where: { key, value: { lt: now.toISOString() } },
      data: { value: until },
    });
    return res.count === 1;
  }
}

async function releaseLock() {
  await prisma.appSetting
    .update({ where: { key: APP_SETTING_KEYS.cronLockUntil }, data: { value: new Date(0).toISOString() } })
    .catch(() => undefined);
}

export async function runScheduledJobs(now: Date = new Date()) {
  if (!(await acquireLock(now))) {
    return { ok: true, skipped: "another run is in progress" };
  }
  try {
    const results = Object.fromEntries(
      [
        await step("expireLeads", () => expireLeadsAndAlert(now)),
        await step("contractorFollowUps", () => sendContractorFollowUps(now)),
        await step("feeReminders", () => sendFeeReminders(now)),
        await step("landownerHireChecks", () => sendLandownerHireChecks(now)),
        await step("invitations", async () => ({ ...(await processInvitationQueue(now)) })),
        await step("wixContractorSync", () => maybeSyncWixContractors(now)),
        await step("outbox", async () => ({ ...(await dispatchPendingNotifications({ limit: 200 })) })),
      ],
    );
    const finishedAt = new Date().toISOString();
    await prisma.appSetting.upsert({
      where: { key: APP_SETTING_KEYS.cronLastRunAt },
      update: { value: finishedAt },
      create: { key: APP_SETTING_KEYS.cronLastRunAt, value: finishedAt },
    });
    await prisma.appSetting.upsert({
      where: { key: APP_SETTING_KEYS.cronLastResult },
      update: { value: JSON.stringify(results).slice(0, 8000) },
      create: { key: APP_SETTING_KEYS.cronLastResult, value: JSON.stringify(results).slice(0, 8000) },
    });
    return { ok: true, finishedAt, results };
  } finally {
    await releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────

async function expireLeadsAndAlert(now: Date) {
  const expiring = await prisma.lead.findMany({
    where: { expiresAt: { lt: now }, status: { in: [LeadStatus.NEW, LeadStatus.DISTRIBUTED] } },
    select: {
      id: true,
      acceptedCount: true,
      propertyZip: true,
      propertyLocation: true,
      contractorCategory: { select: { name: true } },
      _count: { select: { matches: true } },
    },
  });
  const result = await expireLeads(prisma, now);
  let alerts = 0;
  for (const lead of expiring) {
    if (lead.acceptedCount > 0) continue;
    alerts += 1;
    await notifyAdmins({
      kind: "lead_expired_unaccepted",
      title: "No contractor accepted a request",
      lines: [
        `A ${lead.contractorCategory?.name ?? ""} request in ZIP ${lead.propertyZip ?? lead.propertyLocation} expired: ${lead._count.matches} contractor(s) were notified, none accepted.`,
        "Consider calling the homeowner or a contractor directly.",
      ],
      link: { label: "Open the request", path: `/admin/leads/${lead.id}` },
      leadId: lead.id,
    });
  }
  return { ...result, unacceptedAlerts: alerts };
}

async function sendContractorFollowUps(now: Date) {
  const maxAttempts = await getFollowUpMaxAttempts(prisma);
  const due = await prisma.leadMatch.findMany({
    where: {
      status: LeadMatchStatus.ACCEPTED,
      followUpNextAt: { lte: now },
      followUpStage: {
        in: [FOLLOW_UP_STAGES.outcome, FOLLOW_UP_STAGES.payment, FOLLOW_UP_STAGES.paymentLegacy],
      },
    },
    include: {
      successFee: { select: { status: true } },
      contractor: { select: { id: true, name: true } },
      lead: { select: { id: true, propertyZip: true, propertyLocation: true } },
    },
    orderBy: { followUpNextAt: "asc" },
    take: 100,
  });

  let sent = 0;
  let escalated = 0;
  let cleared = 0;
  for (const match of due) {
    const isOutcome = match.followUpStage === FOLLOW_UP_STAGES.outcome;
    const stillRelevant = isOutcome
      ? match.jobOutcome === JobOutcome.OPEN
      : match.jobOutcome === JobOutcome.WON && match.successFee?.status === "AWAITING_CONTRACTOR_PAYMENT";
    if (!stillRelevant) {
      await prisma.leadMatch.update({ where: { id: match.id }, data: { followUpNextAt: null } });
      cleared += 1;
      continue;
    }

    if (match.followUpAttempts >= maxAttempts) {
      await prisma.leadMatch.update({
        where: { id: match.id },
        data: {
          followUpNextAt: null,
          followUpStage: isOutcome ? FOLLOW_UP_STAGES.outcomeNoResponse : FOLLOW_UP_STAGES.paymentNoResponse,
        },
      });
      await notifyAdmins({
        kind: isOutcome ? "outcome_no_response" : "payment_no_response",
        title: isOutcome
          ? `${match.contractor.name} never said if they got a job`
          : `${match.contractor.name} never confirmed being paid`,
        lines: [
          `${maxAttempts} reminders were sent by text and email without an answer.`,
          isOutcome
            ? "Call the contractor (or the homeowner) to find out if the job was won."
            : "Call the contractor to check if the homeowner paid; the success fee depends on it.",
        ],
        link: { label: "Open the request", path: `/admin/leads/${match.lead.id}` },
        leadId: match.lead.id,
        contractorId: match.contractor.id,
      });
      escalated += 1;
      continue;
    }

    const attempt = match.followUpAttempts + 1;
    const token = await createFollowUpToken(prisma, {
      action: isOutcome ? FollowUpAction.REPORT_OUTCOME : FollowUpAction.CONFIRM_PAID,
      leadMatchId: match.id,
    });
    if (isOutcome) await notifyOutcomeCheck(match.id, token.token, attempt);
    else await notifyPaymentCheck(match.id, token.token, attempt);
    const gapDays = FOLLOW_UP_GAPS_DAYS[Math.min(attempt - 1, FOLLOW_UP_GAPS_DAYS.length - 1)];
    await prisma.leadMatch.update({
      where: { id: match.id },
      data: {
        followUpAttempts: attempt,
        followUpNextAt: new Date(now.getTime() + gapDays * DAY),
        ...(match.followUpStage === FOLLOW_UP_STAGES.paymentLegacy
          ? { followUpStage: FOLLOW_UP_STAGES.payment }
          : {}),
      },
    });
    sent += 1;
  }
  return { sent, escalated, cleared };
}

async function sendFeeReminders(now: Date) {
  const fees = await prisma.successFee.findMany({
    where: { status: "DUE", dueAt: { not: null }, reminderCount: { lt: FEE_REMINDER_DAYS.length + 1 } },
    include: {
      leadMatch: { select: { id: true, leadId: true, contractor: { select: { id: true, name: true } } } },
    },
    take: 100,
  });
  let reminded = 0;
  let alerted = 0;
  for (const fee of fees) {
    const dueAt = fee.dueAt!.getTime();
    const n = fee.reminderCount;
    if (n < FEE_REMINDER_DAYS.length) {
      if (now.getTime() < dueAt + FEE_REMINDER_DAYS[n] * DAY) continue;
      const claimed = await prisma.successFee.updateMany({
        where: { id: fee.id, reminderCount: n, status: "DUE" },
        data: { reminderCount: n + 1, lastReminderAt: now },
      });
      if (claimed.count === 0) continue;
      await sendFeeDueNotice(fee.leadMatchId, n + 1);
      reminded += 1;
      continue;
    }
    if (now.getTime() < dueAt + FEE_OVERDUE_ALERT_DAYS * DAY) continue;
    const claimed = await prisma.successFee.updateMany({
      where: { id: fee.id, reminderCount: n, status: "DUE" },
      data: { reminderCount: n + 1 },
    });
    if (claimed.count === 0) continue;
    await notifyAdmins({
      kind: "fee_overdue",
      title: `Success fee overdue: ${fee.leadMatch.contractor.name}`,
      lines: [
        `The fee of $${(fee.feeAmountCents / 100).toFixed(2)} has been due for ${FEE_OVERDUE_ALERT_DAYS} days, after ${FEE_REMINDER_DAYS.length} reminders.`,
        "Contact the contractor or record an offline payment.",
      ],
      link: { label: "Open the fee", path: `/admin/fees/${fee.leadMatchId}` },
      leadId: fee.leadMatch.leadId,
      contractorId: fee.leadMatch.contractor.id,
    });
    alerted += 1;
  }
  return { reminded, alerted };
}

async function sendLandownerHireChecks(now: Date) {
  const first = await prisma.landownerConfirmation.findMany({
    where: { respondedAt: null, sentAt: null, sendAfter: { lte: now } },
    select: { id: true },
    take: 50,
  });
  let sent = 0;
  for (const row of first) {
    const claimed = await prisma.landownerConfirmation.updateMany({
      where: { id: row.id, sentAt: null },
      data: { sentAt: now },
    });
    if (claimed.count === 0) continue;
    if (await notifyLandownerHireCheck(row.id, false)) sent += 1;
  }

  const reminders = await prisma.landownerConfirmation.findMany({
    where: {
      respondedAt: null,
      reminderSentAt: null,
      sentAt: { lte: new Date(now.getTime() - LANDOWNER_REMINDER_DAYS * DAY) },
    },
    select: { id: true },
    take: 50,
  });
  let reminded = 0;
  for (const row of reminders) {
    const claimed = await prisma.landownerConfirmation.updateMany({
      where: { id: row.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;
    if (await notifyLandownerHireCheck(row.id, true)) reminded += 1;
  }
  return { sent, reminded };
}

async function maybeSyncWixContractors(now: Date) {
  const { getWixConfig } = await import("@/lib/integrations/wix/wix-client");
  if (!getWixConfig()) return { skipped: "Wix API not configured" };
  const last = await prisma.appSetting.findUnique({
    where: { key: APP_SETTING_KEYS.wixContractorSyncLastAttemptAt },
  });
  const lastAt = last?.value ? new Date(last.value).getTime() : 0;
  if (Number.isFinite(lastAt) && now.getTime() - lastAt < WIX_SYNC_INTERVAL_HOURS * 3600 * 1000) {
    return { skipped: "synced recently" };
  }
  const { runWixContractorSync } = await import("@/lib/integrations/wix/contractor-sync");
  const summary = await runWixContractorSync({ incremental: true });
  return {
    fetched: summary.fetched,
    created: summary.created,
    updated: summary.updated,
    errors: summary.errors.length,
  } satisfies Prisma.InputJsonObject;
}

/**
 * Safety net for the external cron: when the last run is older than
 * `staleAfterMinutes`, run the jobs right after the current response. Called
 * from busy places (contractor and admin pages, lead intake) so follow-ups keep
 * flowing even if cron-job.org is down or misconfigured. The run lock prevents
 * overlaps; the cost per call is one indexed settings read.
 */
export async function runScheduledJobsIfStale(staleAfterMinutes = 15): Promise<void> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.cronLastRunAt } });
    const last = row?.value ? new Date(row.value).getTime() : 0;
    if (Number.isFinite(last) && Date.now() - last < staleAfterMinutes * 60_000) return;
    const { after } = await import("next/server");
    const run = async () => {
      try {
        await runScheduledJobs();
      } catch (error) {
        console.error("[cron] opportunistic run failed", error);
      }
    };
    try {
      after(run);
    } catch {
      // Outside a request scope: nothing to piggyback on.
    }
  } catch (error) {
    console.error("[cron] staleness check failed", error);
  }
}
