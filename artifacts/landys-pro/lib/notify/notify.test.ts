import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";
import type { LeadSummary } from "@/lib/lead-summary";

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  smsSend: vi.fn(),
  emailSend: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      const target = h.db as unknown as Record<string, unknown>;
      const val = target[prop];
      return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(h.db) : val;
    },
  }),
}));
vi.mock("@/lib/integrations/sms", () => ({
  sms: { send: h.smsSend },
  PERMANENT_SMS_ERROR_CODES: new Set([21211, 21408, 21610, 21612, 21614]),
  SMS_UNSUBSCRIBED_CODE: 21610,
}));
vi.mock("@/lib/integrations/email", () => ({ email: { send: h.emailSend } }));
vi.mock("@/lib/integrations/staging-recipient", () => ({
  safeSmsRecipient: (to: string) => to,
  safeEmailRecipient: (to: string) => to,
}));

import { newLeadMessages, toSmsText, feeDueMessages } from "./templates";
import { nextSmsSendTime } from "./quiet-hours";
import { dispatchPendingNotifications } from "./outbox";

const summary: LeadSummary = {
  categoryName: "Roofing",
  workTypeName: "New Build",
  title: "Roofing - New Build",
  cityState: "Hemphill, TX",
  place: "Hemphill, TX 75948",
  zip: "75948",
  budgetLabel: "Under $5,000",
  timelineLabel: "Within 2 weeks",
  urgencyLabel: "Medium",
  landTypeName: "Residential",
  description: "Roof leaks over the kitchen <after> the storm.",
  landownerName: "Jordan Lee",
  landownerFirstName: "Jordan",
};

describe("message templates", () => {
  it("writes an explicit, plain-ASCII new-job text with an opt-out", () => {
    const { sms, email } = newLeadMessages({
      contractorName: "Caddo Lake Forestry Co",
      summary,
      link: "https://pro.example.com/accept/tok",
      feeRateLabel: "5%",
      direct: false,
      maxAccepts: 3,
      expiresInHours: 48,
      photoCount: 1,
    });
    expect(sms).toMatch(/^Landy's Pro: New job request near Hemphill, TX\./);
    expect(sms).toContain("Roofing - New Build.");
    expect(sms).toContain("Budget: Under $5,000.");
    expect(sms).toContain("When: Within 2 weeks.");
    expect(sms).toContain("Landy's fee is 5%");
    expect(sms).toContain("https://pro.example.com/accept/tok");
    expect(sms).toContain("Reply STOP to opt out.");
    expect(/^[\x20-\x7E]*$/.test(sms)).toBe(true);

    expect(email.subject).toBe("New job request: Roofing - New Build near Hemphill, TX (Under $5,000)");
    expect(email.text).toContain("The first 3 to accept get the homeowner's name, phone and email.");
    expect(email.html).toContain("Roof leaks over the kitchen &lt;after&gt; the storm.");
    expect(email.html).not.toContain("<after>");
  });

  it("tells a directly-requested pro that the homeowner chose them", () => {
    const { sms, email } = newLeadMessages({
      contractorName: "Acme",
      summary,
      link: "https://x/accept/t",
      feeRateLabel: null,
      direct: true,
      maxAccepts: 1,
      expiresInHours: 48,
      photoCount: 0,
    });
    expect(sms).toContain("asked YOU for an estimate");
    expect(email.text).toContain("Only you received this request.");
  });

  it("states the fee amount, rate and job price in the fee-due text", () => {
    const { sms } = feeDueMessages({
      contractorName: "Acme",
      summary,
      link: "https://x/follow-up/t",
      feeAmountCents: 25_000,
      finalValueCents: 500_000,
      ratePercentLabel: "5%",
      reminderNumber: 0,
    });
    expect(sms).toContain("is due: $250.00 (5% of $5,000.00)");
  });

  it("strips characters that would triple the SMS cost", () => {
    expect(toSmsText("Landy’s – “roof” · ok…")).toBe(`Landy's - "roof" - ok...`);
  });
});

describe("SMS quiet hours", () => {
  it("holds a 11 pm Texas text until 8 am", () => {
    const at = new Date("2026-11-14T05:00:00Z"); // 23:00 in Chicago (CST, UTC-6)
    const next = nextSmsSendTime(at, "America/Chicago");
    expect(next.toISOString()).toBe("2026-11-14T14:00:00.000Z"); // 08:00 CST
  });

  it("sends immediately during the day", () => {
    const at = new Date("2026-11-14T18:30:00Z"); // 12:30 in Chicago
    expect(nextSmsSendTime(at, "America/Chicago").getTime()).toBe(at.getTime());
  });
});

describe("notification outbox", () => {
  beforeEach(() => {
    h.db = createFakeDb();
    h.smsSend.mockReset();
    h.emailSend.mockReset();
  });

  function queue(row: Record<string, unknown>) {
    h.db.notificationMessage.seed([
      {
        id: "m1",
        channel: "sms",
        kind: "lead.new",
        recipient: "+15125550100",
        body: "hello",
        status: "PENDING",
        attempts: 0,
        sendAfter: new Date(Date.now() - 1000),
        contractorId: "c1",
        ...row,
      },
    ]);
  }

  it("marks a delivered message as sent", async () => {
    queue({});
    h.smsSend.mockResolvedValue({ ok: true, id: "SM1", mocked: false });
    const result = await dispatchPendingNotifications();
    expect(result.sent).toBe(1);
    expect(h.db.notificationMessage.rows[0]).toEqual(expect.objectContaining({ status: "SENT", providerId: "SM1" }));
  });

  it("retries a temporary failure later", async () => {
    queue({});
    h.smsSend.mockResolvedValue({ ok: false, error: "timeout", mocked: false });
    const result = await dispatchPendingNotifications();
    expect(result.retried).toBe(1);
    const row = h.db.notificationMessage.rows[0];
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(1);
    expect((row.sendAfter as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("stops texting a contractor who replied STOP", async () => {
    queue({});
    h.db.contractor.seed([{ id: "c1", name: "C", email: "c@x.com", phone: "+15125550100" }]);
    h.smsSend.mockResolvedValue({ ok: false, error: "unsubscribed", code: 21610, mocked: false });
    const result = await dispatchPendingNotifications();
    expect(result.skipped).toBe(1);
    expect(h.db.notificationMessage.rows[0].status).toBe("SKIPPED");
    expect(h.db.contractor.rows[0].smsOptedOutAt).toBeInstanceOf(Date);
  });

  it("gives up after the last attempt and records it", async () => {
    queue({ attempts: 3 });
    h.smsSend.mockResolvedValue({ ok: false, error: "carrier down", mocked: false });
    const result = await dispatchPendingNotifications();
    expect(result.failed).toBe(1);
    expect(h.db.notificationMessage.rows[0].status).toBe("FAILED");
    expect(h.db.auditLog.rows.some((r) => r.action === "NOTIFICATION_FAILED")).toBe(true);
  });

  it("does not send messages scheduled for later (quiet hours)", async () => {
    queue({ sendAfter: new Date(Date.now() + 3600_000) });
    const result = await dispatchPendingNotifications();
    expect(result.sent + result.failed + result.retried).toBe(0);
    expect(h.smsSend).not.toHaveBeenCalled();
  });
});
