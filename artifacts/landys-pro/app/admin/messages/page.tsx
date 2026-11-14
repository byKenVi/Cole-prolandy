import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AdminEmptyState, AdminTabBar, AdminTabLink, Chip, PageHeader, Panel } from "@/components/admin/ui";
import { TestMessageForm } from "@/components/admin/test-message-form";

export const dynamic = "force-dynamic";

type Tab = "all" | "failed" | "pending";

const KIND_LABELS: Record<string, string> = {
  "lead.new": "New job request",
  "followup.outcome": "Did you get the job?",
  "followup.payment": "Have you been paid?",
  "fee.due": "Fee due",
  "fee.reminder": "Fee reminder",
  "landowner.contractor_accepted": "Homeowner: a pro accepted",
  "landowner.hire_check": "Homeowner: who did you hire?",
  "landowner.hire_check_reminder": "Homeowner: reminder",
  "contractor.invitation": "Account invitation",
};

function label(kind: string) {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  if (kind.startsWith("admin.")) return "Admin alert";
  return kind;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; text: string }> = {
  SENT: { bg: "var(--sage)", fg: "var(--pos)", text: "Sent" },
  PENDING: { bg: "var(--chipBg)", fg: "var(--ink2)", text: "Waiting" },
  SENDING: { bg: "var(--chipBg)", fg: "var(--ink2)", text: "Sending" },
  FAILED: { bg: "#F6E4E1", fg: "var(--danger)", text: "Failed" },
  SKIPPED: { bg: "var(--chipBg)", fg: "var(--ink3)", text: "Not sent" },
};

const cell: React.CSSProperties = { padding: "12px 14px", font: "400 14px/1.4 'Inter'", verticalAlign: "top" };
const head: React.CSSProperties = { ...cell, font: "500 13px/1.3 Rubik, sans-serif", color: "var(--ink2)", textAlign: "left" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const raw = (await searchParams).tab;
  const tab: Tab = raw === "failed" || raw === "pending" ? raw : "all";
  const filter: Prisma.NotificationMessageWhereInput =
    tab === "failed" ? { status: "FAILED" } : tab === "pending" ? { status: { in: ["PENDING", "SENDING"] } } : {};

  const [rows, failed, pending, cronLast] = await Promise.all([
    prisma.notificationMessage.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        channel: true,
        kind: true,
        recipient: true,
        subject: true,
        body: true,
        status: true,
        attempts: true,
        lastError: true,
        sendAfter: true,
        sentAt: true,
        createdAt: true,
        leadId: true,
        contractorId: true,
      },
    }),
    prisma.notificationMessage.count({ where: { status: "FAILED" } }),
    prisma.notificationMessage.count({ where: { status: { in: ["PENDING", "SENDING"] } } }),
    prisma.appSetting.findUnique({ where: { key: "cronLastRunAt" } }),
  ]);

  const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div>
      <PageHeader
        kicker="Notifications"
        title="Messages"
        subtitle={`Every text and email sent by Landy's Pro. Texts are held between 9 pm and 8 am in the recipient's time zone. Scheduler last ran: ${cronLast?.value ? fmt(new Date(cronLast.value)) : "never"}.`}
      />
      <TestMessageForm />
      <AdminTabBar>
        <AdminTabLink href="/admin/messages" active={tab === "all"}>
          Latest
        </AdminTabLink>
        <AdminTabLink href="/admin/messages?tab=pending" active={tab === "pending"} count={pending}>
          Waiting
        </AdminTabLink>
        <AdminTabLink href="/admin/messages?tab=failed" active={tab === "failed"} count={failed}>
          Failed
        </AdminTabLink>
      </AdminTabBar>
      <Panel style={{ marginTop: 16 }}>
        {rows.length === 0 ? (
          <AdminEmptyState title="No messages" description="Messages appear here as soon as they are queued." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th style={head}>When</th>
                  <th style={head}>Message</th>
                  <th style={head}>To</th>
                  <th style={head}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = STATUS_STYLE[row.status] ?? STATUS_STYLE.PENDING;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {fmt(row.sentAt ?? row.createdAt)}
                        {row.status === "PENDING" && row.sendAfter > new Date() && (
                          <div style={{ color: "var(--ink3)", fontSize: 12 }}>Sends {fmt(row.sendAfter)}</div>
                        )}
                      </td>
                      <td style={cell}>
                        <div style={{ fontWeight: 600 }}>
                          {row.channel === "sms" ? "Text" : "Email"}: {label(row.kind)}
                        </div>
                        <details>
                          <summary style={{ cursor: "pointer", color: "var(--ink2)" }}>
                            {row.subject ?? row.body.slice(0, 80)}
                          </summary>
                          <pre style={{ whiteSpace: "pre-wrap", font: "400 13px/1.45 'Inter'", margin: "8px 0 0", color: "var(--ink)" }}>
                            {row.body}
                          </pre>
                        </details>
                        {row.leadId && (
                          <a href={`/admin/leads/${row.leadId}`} style={{ fontSize: 12, color: "var(--goldStrong)" }}>
                            Open the request
                          </a>
                        )}
                      </td>
                      <td style={{ ...cell, wordBreak: "break-all" }}>{row.recipient || "(none)"}</td>
                      <td style={cell}>
                        <Chip bg={status.bg} fg={status.fg}>
                          {status.text}
                        </Chip>
                        {row.attempts > 1 && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{row.attempts} attempts</div>}
                        {row.lastError && (
                          <div style={{ fontSize: 12, color: row.status === "FAILED" ? "var(--danger)" : "var(--ink2)", marginTop: 4 }}>
                            {row.lastError.slice(0, 200)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
