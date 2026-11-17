import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { APP_SETTING_KEYS } from "@/lib/domain/types";
import { getWixConfig } from "@/lib/integrations/wix/wix-client";
import { timeAgo } from "@/lib/format";
import { SyncContractorsButton } from "@/components/admin/sync-contractors-button";
import { todoButtonStyle } from "@/components/admin/todo-button-style";

export type Check = {
  level: "error" | "warn";
  title: string;
  detail: string;
  /** Either a link to the place where it gets fixed, or an in-place action. */
  action?: { href: string; label: string } | "sync-contractors";
};

/**
 * The dashboard to-do list: production problems and work waiting for an
 * admin. Only problems are listed; when everything is fine nothing renders.
 * Severity is carried by the icon, and every item says what to do next.
 */
export async function SystemHealth() {
  const now = Date.now();
  const [cronRow, noArea, held, failed, wixSync, testContractors, testLeads] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: APP_SETTING_KEYS.cronLastRunAt } }),
    prisma.contractor.count({
      where: { deactivatedAt: null, serviceZipCodes: { isEmpty: true }, serviceCounties: { isEmpty: true } },
    }),
    prisma.lead.count({
      where: {
        reviewStatus: "PENDING_REVIEW",
        status: { in: ["NEW", "DISTRIBUTED"] },
        createdAt: { gte: new Date(now - 30 * 86400_000) },
      },
    }),
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
      title: cronAt ? `The scheduler stopped ${timeAgo(new Date(cronAt)).toLowerCase()}` : "The scheduler has never run",
      detail:
        "Follow-ups, fee reminders, scheduled invitations and request expiry are on hold until cron-job.org calls /api/cron/run again.",
    });
  }
  if (process.env.ONLINE_PAYMENTS_ENABLED === "false") {
    checks.push({
      level: "warn",
      title: "Online fee payment is off",
      detail: "Contractors are told Landy's will collect the fee. Record each payment on the Success fees page.",
      action: { href: "/admin/fees?tab=due", label: "Open fees due" },
    });
  } else if (production && process.env.STRIPE_MOCK !== "false") {
    checks.push({
      level: "error",
      title: "Payments are in test mode",
      detail: 'STRIPE_MOCK is not "false", so contractors cannot pay their fees.',
    });
  }
  if (production && process.env.RESEND_MOCK === "true") {
    checks.push({
      level: "error",
      title: "Email is turned off",
      detail: "RESEND_MOCK is true. No email reaches contractors or homeowners.",
    });
  }
  const from = process.env.RESEND_FROM?.trim() ?? "";
  if (production && (!from || from.includes("resend.dev"))) {
    checks.push({
      level: "error",
      title: "No verified sending domain",
      detail: "Emails only reach the Resend account owner until a domain such as landys.co is verified (RESEND_FROM).",
    });
  }
  if (production && process.env.TWILIO_MOCK !== "false") {
    checks.push({ level: "error", title: "Text messages are turned off", detail: 'TWILIO_MOCK is not "false".' });
  }
  if (production && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
    checks.push({
      level: "warn",
      title: "Texts are sent from an unregistered number",
      detail: "No Twilio Messaging Service (A2P 10DLC) is set, so US carriers may filter them.",
    });
  }
  if (!process.env.CRON_SECRET) {
    checks.push({
      level: "error",
      title: "The scheduler cannot be called",
      detail: "CRON_SECRET is not set, so /api/cron/run refuses every call.",
    });
  }
  if (!getWixConfig()) {
    checks.push({
      level: "warn",
      title: "The landys.co contractor sync is not set up",
      detail: "Add WIX_SITE_ID and WIX_API_AUTHORIZATION to import contractors.",
    });
  } else if (!wixSync?.value) {
    checks.push({
      level: "warn",
      title: "Contractors have never been imported from landys.co",
      detail: "Requests can only reach contractors that exist here. The sync then runs every 6 hours.",
      action: "sync-contractors",
    });
  }
  if (production && (testContractors.length > 0 || testLeads > 0)) {
    const parts = [
      testContractors.length ? `contractors ${testContractors.map((c) => c.name).join(", ")}` : "",
      testLeads ? `${testLeads} open test request${testLeads > 1 ? "s" : ""}` : "",
    ].filter(Boolean);
    checks.push({
      level: "warn",
      title: "Test data is live in production",
      detail: `${parts.join(" and ")}. Deactivate or close them so they never receive or show real jobs.`,
      action: { href: "/admin/contractors", label: "Review contractors" },
    });
  }
  if (held > 0) {
    checks.push({
      level: "warn",
      title: `${held} request${held > 1 ? "s" : ""} waiting for your review`,
      detail: "Not sent to any contractor yet.",
      action: { href: "/admin/leads?status=review", label: "Review" },
    });
  }
  if (noArea > 0) {
    checks.push({
      level: "warn",
      title: `${noArea} active contractor${noArea > 1 ? "s have" : " has"} no service area`,
      detail: "They only receive requests when no contractor near the property covers it.",
      action: { href: "/admin/contractors?filter=no-area", label: "Show them" },
    });
  }
  if (failed > 0) {
    checks.push({
      level: "warn",
      title: `${failed} message${failed > 1 ? "s" : ""} failed this week`,
      detail: "Texts or emails that did not reach a contractor or a homeowner.",
      action: { href: "/admin/messages?tab=failed", label: "See failed messages" },
    });
  }

  return <SystemHealthView checks={checks} />;
}

/** Presentational part, separate so it can be previewed without a database. */
export function SystemHealthView({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return null;
  return (
    <section
      aria-label="Needs your attention"
      style={{
        marginBottom: 24,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--card)",
      }}
    >
      <h2
        style={{
          margin: 0,
          padding: "14px 20px",
          borderBottom: "1px solid var(--line)",
          font: "600 17px/1.2 var(--head)",
          color: "var(--ink)",
        }}
      >
        Needs your attention <span style={{ color: "var(--ink3)", fontWeight: 500 }}>{checks.length}</span>
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {checks.map((check, i) => {
          const Icon = check.level === "error" ? CircleAlert : TriangleAlert;
          return (
            <li
              key={i}
              className="admin-todo"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 20px",
                borderTop: i ? "1px solid var(--line2)" : undefined,
              }}
            >
              <Icon
                size={20}
                strokeWidth={2}
                aria-label={check.level === "error" ? "Blocking" : "To check"}
                style={{ flex: "none", color: check.level === "error" ? "var(--danger)" : "var(--warn)" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, font: "600 15px/1.35 var(--ui)", color: "var(--ink)" }}>{check.title}</p>
                <p style={{ margin: "2px 0 0", font: "400 14px/1.45 var(--ui)", color: "var(--ink2)" }}>
                  {check.detail}
                </p>
              </div>
              {check.action === "sync-contractors" ? (
                <SyncContractorsButton />
              ) : check.action ? (
                <Link href={check.action.href} className="a-ghostbtn" style={todoButtonStyle}>
                  {check.action.label}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
