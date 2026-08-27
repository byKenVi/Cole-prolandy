import { prisma } from "@/lib/prisma";
import { DestructiveBurstError } from "@/lib/domain/errors";

/**
 * Anti-runaway guard for destructive admin actions (deactivate / delete / refund).
 *
 * Background: on Aug 26-27 2026, an automated browser session (almost certainly
 * an E2E/testing tool run against the dev preview) drove the real
 * "deactivate contractor" admin action across the entire contractor list at a
 * ~3s cadence for over two hours, using a genuine admin's authenticated
 * session. Because this project's dev workflow, tests, and production
 * deployment all read the same DATABASE_URL, that automated run silently
 * mass-mutated production data with no way for the server to tell the
 * request apart from a real admin click -- same session, same server action,
 * same shape of request.
 *
 * This guard can't detect "is this a human," but it can detect the one thing
 * that reliably differs between a human doing admin work and a script/test
 * sweeping every row: cadence. A real admin doing bulk cleanup by hand cannot
 * sustain more than a handful of these actions within a couple of minutes; an
 * automated sweep can trivially exceed that. Tripping the guard never blocks a
 * single action -- only a fast, repeated burst of the SAME destructive action
 * by the SAME actor.
 *
 * This is intentionally not a general-purpose rate limiter (see project
 * guidance against arbitrary rate limits) -- it is scoped to the specific
 * class of action implicated in this incident: contractor deactivate/delete
 * and lead refund/restitution.
 */
const WINDOW_MS = 2 * 60 * 1000;
const MAX_IN_WINDOW = 5;

export async function assertNoDestructiveBurst(params: {
  actorId: string | null;
  action: string;
}): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const recentCount = await prisma.auditLog.count({
    where: {
      actorId: params.actorId ?? "unknown-admin",
      action: params.action,
      createdAt: { gte: since },
    },
  });
  if (recentCount >= MAX_IN_WINDOW) {
    throw new DestructiveBurstError(params.action, recentCount);
  }
}
