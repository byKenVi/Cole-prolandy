import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { APP_SETTING_KEYS } from "@/lib/domain/types";
import { getWixConfig } from "@/lib/integrations/wix/wix-client";

type Check = { level: "error" | "warn"; text: string; href?: string; linkLabel?: string };

/**
 * Production readiness checks shown at the top of the admin dashboard.
 * Only problems are listed; when everything is fine nothing renders.
 */
export async function SystemHealth() {
  const now = Date.now();
  const [cronRow, noArea, held, failed, wixSync, testContractors, testLeads] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.cronLastRunAt } }),
    prisma.contractor.count({
      where: { deactivatedAt: null, serviceZipCodes: { isEmpty: true }, serviceCounties: { isEmpty: true } },
    }),
    prisma.lead.count({ where: { reviewStatus: "PENDING_REVIEW", createdAt: { gte: new Date(now - 30 * 86400_000) } } }),
    prisma.notificationMessage.count({ where: { status: "FAILED", createdAt: { gte: new Date(now - 7 * 86400_000) } } }),
    prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.wixContractorSyncLastSuccessAt } }),
    // Test records (old QA route, e2e smoke test) that must never get real leads in production.
    prisma.contractor.findMany({
      where: {
        deactivatedAt: null,
        OR: [
          { id: { startsWith: "qa_" } },
          { name: { contains: "QA", mode: "insensitive" } },
          { name: { startsWith: "E2E" } },
          { email: { endsWith: "@landys.test" } },
          { email: { endsWith: "@example.com" } },
        ],
      },
      select: { name: true },
      take: 5,
    }),
    prisma.lead.count({
      where: {
        status: { in: ["NEW", "DISTRIBUTED"] },
        OR: [{ source: { in: ["production_qa", "e2e_smoke"] } }, { externalRequestId: { startsWith: "e2e-" } }],
      },
    }),
  ]);

  const checks: Check[] = [];
  const production = process.env.NODE_ENV === "production";
  const cronAt = cronRow?.value ? new Date(cronRow.value).getTime() : 0;
  if (!cronAt || now - cronAt > 30 * 60_000) {
    checks.push({
      level: "error",
      text: cronAt
        ? `The scheduler has not run since ${new Date(cronAt).toLocaleString("en-US")}. Follow-ups, reminders and lead expiry are paused.`
        : "The scheduler has never run. Follow-ups, fee reminders, scheduled invitations and lead expiry will not happen until cron-job.org calls /api/cron/run.",
    });
  }
  if (process.env.ONLINE_PAYMENTS_ENABLED === "false") {
    checks.push({
      level: "warn",
      text: "Online fee payment is turned off (ONLINE_PAYMENTS_ENABLED=false). Contractors are told Landy's will collect fees; record payments on the Success fees page.",
    });
  } else if (production && process.env.STRIPE_MOCK !== "false") {
    checks.push({ level: "error", text: 'Payments are in test mode (STRIPE_MOCK is not "false"). Contractors cannot pay fees.' });
  }
  if (production && process.env.RESEND_MOCK === "true") {
    checks.push({ level: "error", text: "Email is disabled (RESEND_MOCK=true). No email reaches contractors or homeowners." });
  }
  const from = process.env.RESEND_FROM?.trim() ?? "";
  if (production && (!from || from.includes("resend.dev"))) {
    checks.push({
      level: "error",
      text: "No verified sending domain (RESEND_FROM). Emails can only reach the Resend account owner until a domain such as landys.co is verified.",
    });
  }
  if (production && process.env.TWILIO_MOCK !== "false") {
    checks.push({ level: "error", text: 'Text messages are disabled (TWILIO_MOCK is not "false").' });
  }
  if (production && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
    checks.push({
      level: "warn",
      text: "No Twilio Messaging Service (A2P 10DLC) configured. US carriers may filter texts sent from an unregistered number.",
    });
  }
  if (!process.env.CRON_SECRET) {
    checks.push({ level: "error", text: "CRON_SECRET is not set, so the scheduler endpoint refuses every call." });
  }
  if (!getWixConfig()) {
    checks.push({ level: "warn", text: "landys.co contractor sync is not configured (WIX_SITE_ID / WIX_API_AUTHORIZATION)." });
  } else if (!wixSync?.value) {
    checks.push({ level: "warn", text: "Contractors have never been synced from landys.co.", href: "/admin/contractors", linkLabel: "Sync now" });
  }
  if (production && (testContractors.length > 0 || testLeads > 0)) {
    checks.push({
      level: "warn",
      text: `Test data is active in production: ${[
        testContractors.length ? `contractor(s) ${testContractors.map((c) => c.name).join(", ")}` : "",
        testLeads ? `${testLeads} open test request(s)` : "",
      ]
        .filter(Boolean)
        .join(" and ")}. Deactivate or close them so they never receive or show real jobs.`,
      href: "/admin/contractors",
      linkLabel: "Review",
    });
  }
  if (noArea > 0) {
    checks.push({
      level: "warn",
      text: `${noArea} active contractor${noArea > 1 ? "s have" : " has"} no service area. They only receive leads when nobody nearby covers them.`,
      href: "/admin/contractors",
      linkLabel: "Review",
    });
  }
  if (held > 0) {
    checks.push({
      level: "warn",
      text: `${held} request${held > 1 ? "s are" : " is"} waiting for your review (not sent to any contractor).`,
      href: "/admin/leads",
      linkLabel: "Review",
    });
  }
  if (failed > 0) {
    checks.push({
      level: "warn",
      text: `${failed} message${failed > 1 ? "s" : ""} failed in the last 7 days.`,
      href: "/admin/messages?tab=failed",
      linkLabel: "See messages",
    });
  }

  if (checks.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="System checks"
      style={{
        marginBottom: 22,
        border: "1px solid var(--line)",
        borderRadius: 16,
        background: "var(--card)",
        overflow: "hidden",
      }}
    >
      {checks.map((check, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "baseline",
            padding: "12px 16px",
            borderTop: i ? "1px solid var(--line)" : undefined,
            borderLeft: `4px solid ${check.level === "error" ? "var(--danger)" : "var(--goldStrong)"}`,
            font: "400 14px/1.45 'Inter'",
            color: "var(--ink)",
          }}
        >
          <strong style={{ color: check.level === "error" ? "var(--danger)" : "var(--goldStrong)", whiteSpace: "nowrap" }}>
            {check.level === "error" ? "Action needed" : "Check"}
          </strong>
          <span style={{ flex: 1 }}>{check.text}</span>
          {check.href && (
            <Link href={check.href} style={{ color: "var(--goldStrong)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {check.linkLabel ?? "Open"}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
