import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/domain/types";
import { email } from "@/lib/integrations/email";
import {
  PERMANENT_SMS_ERROR_CODES,
  SMS_UNSUBSCRIBED_CODE,
  sms,
} from "@/lib/integrations/sms";
import { safeEmailRecipient, safeSmsRecipient } from "@/lib/integrations/staging-recipient";

/**
 * Notification outbox. Callers enqueue; a dispatcher sends. This gives us:
 *   - one log of every SMS / email (admin "Messages" page);
 *   - retries with backoff for transient provider errors;
 *   - SMS quiet hours (rows with a future `sendAfter`);
 *   - throttling under Resend's 2 requests/second limit.
 * Immediate messages are dispatched right after the HTTP response (`after()`),
 * and the cron dispatcher picks up anything left behind.
 */

export type OutboxChannel = "sms" | "email";

export type OutboxMessage = {
  channel: OutboxChannel;
  kind: string;
  recipient: string;
  subject?: string | null;
  body: string;
  html?: string | null;
  contractorId?: string | null;
  leadId?: string | null;
  leadMatchId?: string | null;
  sendAfter?: Date;
  /** Recorded as SKIPPED instead of sent (e.g. contractor opted out). */
  skipReason?: string | null;
};

const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MINUTES = [5, 30, 120];
const EMAIL_SPACING_MS = 550;

export async function enqueueNotifications(
  db: DbClient,
  messages: OutboxMessage[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const message of messages) {
    const row = await db.notificationMessage.create({
      data: {
        channel: message.channel,
        kind: message.kind,
        recipient: message.recipient,
        subject: message.subject ?? null,
        body: message.body,
        html: message.html ?? null,
        contractorId: message.contractorId ?? null,
        leadId: message.leadId ?? null,
        leadMatchId: message.leadMatchId ?? null,
        sendAfter: message.sendAfter ?? new Date(),
        status: message.skipReason ? "SKIPPED" : "PENDING",
        lastError: message.skipReason ?? null,
      },
      select: { id: true },
    });
    ids.push(row.id);
  }
  return ids;
}

/** Send the given rows as soon as the current response is flushed. */
export function dispatchSoon(ids: string[]): void {
  if (ids.length === 0) return;
  const run = async () => {
    try {
      await dispatchPendingNotifications({ ids });
    } catch (error) {
      console.error("[outbox] immediate dispatch failed", error);
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests): run detached.
    void run();
  }
}

/** Enqueue then dispatch right after the response. */
export async function enqueueAndDispatch(messages: OutboxMessage[]): Promise<string[]> {
  const ids = await enqueueNotifications(prisma, messages);
  dispatchSoon(ids);
  return ids;
}

export type DispatchSummary = { sent: number; failed: number; retried: number; skipped: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchPendingNotifications(options: {
  ids?: string[];
  limit?: number;
  now?: Date;
} = {}): Promise<DispatchSummary> {
  const now = options.now ?? new Date();
  const summary: DispatchSummary = { sent: 0, failed: 0, retried: 0, skipped: 0 };

  // Rows stuck in SENDING (process died mid-send) go back to the queue.
  await prisma.notificationMessage.updateMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - 15 * 60_000) } },
    data: { status: "PENDING" },
  });

  const rows = await prisma.notificationMessage.findMany({
    where: {
      status: "PENDING",
      sendAfter: { lte: now },
      ...(options.ids ? { id: { in: options.ids } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 100,
  });

  let lastEmailAt = 0;
  for (const row of rows) {
    const claimed = await prisma.notificationMessage.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    const attempt = row.attempts + 1;

    let ok = false;
    let error = "";
    let providerId: string | null = null;
    let permanent = false;
    let unsubscribed = false;

    try {
      if (row.channel === "sms") {
        const result = await sms.send({ to: safeSmsRecipient(row.recipient), body: row.body });
        if (result.ok) {
          ok = true;
          providerId = result.id;
        } else {
          error = result.error;
          permanent = result.code !== undefined && PERMANENT_SMS_ERROR_CODES.has(result.code);
          unsubscribed = result.code === SMS_UNSUBSCRIBED_CODE;
        }
      } else {
        const wait = lastEmailAt + EMAIL_SPACING_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastEmailAt = Date.now();
        const result = await email.send({
          to: safeEmailRecipient(row.recipient),
          subject: row.subject ?? "Landy's Pro",
          text: row.body,
          ...(row.html ? { html: row.html } : {}),
        });
        if (result.ok) {
          ok = true;
          providerId = result.id;
        } else {
          error = result.error;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    if (ok) {
      await prisma.notificationMessage.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), providerId, lastError: null },
      });
      summary.sent += 1;
      continue;
    }

    if (unsubscribed && row.contractorId) {
      await prisma.contractor
        .update({ where: { id: row.contractorId }, data: { smsOptedOutAt: new Date() } })
        .catch(() => undefined);
    }

    const giveUp = permanent || attempt >= MAX_ATTEMPTS;
    if (giveUp) {
      await prisma.notificationMessage.update({
        where: { id: row.id },
        data: { status: unsubscribed ? "SKIPPED" : "FAILED", lastError: error.slice(0, 1000) },
      });
      if (unsubscribed) summary.skipped += 1;
      else summary.failed += 1;
      await prisma.auditLog
        .create({
          data: {
            actorType: "system",
            action: "NOTIFICATION_FAILED",
            targetType: row.leadId ? "Lead" : row.contractorId ? "Contractor" : "NotificationMessage",
            targetId: row.leadId ?? row.contractorId ?? row.id,
            metadata: {
              messageId: row.id,
              channel: row.channel,
              kind: row.kind,
              error: error.slice(0, 500),
              attempts: attempt,
            },
          },
        })
        .catch(() => undefined);
      console.error("[outbox] giving up", { id: row.id, kind: row.kind, channel: row.channel, error });
      continue;
    }

    const delay = RETRY_DELAYS_MINUTES[Math.min(attempt - 1, RETRY_DELAYS_MINUTES.length - 1)];
    await prisma.notificationMessage.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        lastError: error.slice(0, 1000),
        sendAfter: new Date(Date.now() + delay * 60_000),
      },
    });
    summary.retried += 1;
  }

  return summary;
}
