import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── SDK mocks (hoisted so the lazy `await import(...)` inside the providers
//    resolves to these fakes; no real Twilio/Resend network calls) ────────────
const { twilioCreate, twilioFactory } = vi.hoisted(() => {
  const twilioCreate = vi.fn();
  const twilioFactory = vi.fn(() => ({ messages: { create: twilioCreate } }));
  return { twilioCreate, twilioFactory };
});
vi.mock("twilio", () => ({ default: twilioFactory }));

const { resendSend, ResendCtor } = vi.hoisted(() => {
  const resendSend = vi.fn();
  const ResendCtor = vi.fn(() => ({ emails: { send: resendSend } }));
  return { resendSend, ResendCtor };
});
vi.mock("resend", () => ({ Resend: ResendCtor }));

// Prisma is mocked so recordFailure()'s AuditLog write doesn't touch a real DB.
const { auditCreate } = vi.hoisted(() => ({ auditCreate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: auditCreate } } }));

import {
  MockSmsProvider,
  TwilioSmsProvider,
} from "@/lib/integrations/sms";
import {
  MockEmailProvider,
  ResendEmailProvider,
} from "@/lib/integrations/email";
import { sms } from "@/lib/integrations/sms";
import { email } from "@/lib/integrations/email";
import { notifyNewLead, type LeadNotification } from "@/lib/notifications";

const ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ENV };
});

afterEach(() => {
  process.env = ENV;
  vi.restoreAllMocks();
});

describe("SMS — mock mode", () => {
  it("logs and returns success WITHOUT touching the Twilio SDK", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = new MockSmsProvider();

    const res = await provider.send({ to: "+14155550100", body: "hi" });

    expect(res).toEqual({ ok: true, id: expect.any(String), mocked: true });
    expect(logSpy).toHaveBeenCalled();
    expect(twilioFactory).not.toHaveBeenCalled();
    expect(twilioCreate).not.toHaveBeenCalled();
  });
});

describe("SMS — live mode", () => {
  it("calls the Twilio SDK with the right args (from-number sender)", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok_test";
    process.env.TWILIO_FROM = "+15005550006";
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    twilioCreate.mockResolvedValue({ sid: "SM123" });

    const res = await new TwilioSmsProvider().send({
      to: "+14155550100",
      body: "New lead",
    });

    expect(twilioFactory).toHaveBeenCalledWith("AC_test", "tok_test");
    expect(twilioCreate).toHaveBeenCalledWith({
      to: "+14155550100",
      body: "New lead",
      from: "+15005550006",
    });
    expect(res).toEqual({ ok: true, id: "SM123", mocked: false });
  });

  it("prefers a Messaging Service SID over a from-number", async () => {
    const messagingServiceSid = `MG${"a".repeat(32)}`;
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok_test";
    process.env.TWILIO_FROM = "+15005550006";
    process.env.TWILIO_MESSAGING_SERVICE_SID = messagingServiceSid;
    twilioCreate.mockResolvedValue({ sid: "SM999" });

    await new TwilioSmsProvider().send({ to: "+14155550100", body: "x" });

    expect(twilioCreate).toHaveBeenCalledWith({
      to: "+14155550100",
      body: "x",
      messagingServiceSid,
    });
  });

  it("never throws — returns a structured failure when the SDK rejects", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok_test";
    process.env.TWILIO_FROM = "+15005550006";
    twilioCreate.mockRejectedValue(new Error("unverified recipient (trial)"));

    const res = await new TwilioSmsProvider().send({
      to: "+14155550100",
      body: "x",
    });

    expect(res).toEqual({
      ok: false,
      mocked: false,
      error: "unverified recipient (trial)",
    });
  });
});

describe("Email — mock & live mode", () => {
  it("mock mode logs and returns success without the Resend SDK", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await new MockEmailProvider().send({
      to: "a@b.com",
      subject: "hi",
    });
    expect(res).toEqual({ ok: true, id: expect.any(String), mocked: true });
    expect(logSpy).toHaveBeenCalled();
    expect(ResendCtor).not.toHaveBeenCalled();
  });

  it("live mode calls the Resend SDK with the right args", async () => {
    process.env.RESEND_API_KEY = "re_key";
    process.env.RESEND_FROM = "leads@landyspro.com";
    resendSend.mockResolvedValue({ data: { id: "re_1" }, error: null });

    const res = await new ResendEmailProvider().send({
      to: "a@b.com",
      subject: "New lead",
      text: "body",
    });

    expect(ResendCtor).toHaveBeenCalledWith("re_key");
    expect(resendSend).toHaveBeenCalledWith({
      from: "leads@landyspro.com",
      to: "a@b.com",
      subject: "New lead",
      text: "body",
    });
    expect(res).toEqual({ ok: true, id: "re_1", mocked: false });
  });
});

describe("notifyNewLead — failure surfacing", () => {
  const base: LeadNotification = {
    contractor: { name: "Pat", email: "pat@x.com", phone: "+14155550100" },
    acceptToken: "tok_abc",
    projectTypeName: "Fencing",
    propertyLocation: "Austin, TX",
    tier: 1,
    priceCents: 5000,
    leadId: "lead_1",
    contractorId: "c_1",
  };

  it("captures + logs a failed send and does NOT throw", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // SMS fails (structured failure), email succeeds.
    vi.spyOn(sms, "send").mockResolvedValue({
      ok: false,
      mocked: false,
      error: "boom",
    });
    vi.spyOn(email, "send").mockResolvedValue({
      ok: true,
      id: "e1",
      mocked: true,
    });

    await expect(notifyNewLead(base)).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "NOTIFICATION_FAILED",
        targetId: "lead_1",
        metadata: expect.objectContaining({
          channel: "sms",
          leadId: "lead_1",
          contractorId: "c_1",
          error: "boom",
        }),
      }),
    });
  });

  it("does not throw even when a provider throws AND the audit write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(sms, "send").mockRejectedValue(new Error("network down"));
    vi.spyOn(email, "send").mockResolvedValue({
      ok: true,
      id: "e1",
      mocked: true,
    });
    auditCreate.mockRejectedValue(new Error("db down"));

    await expect(notifyNewLead(base)).resolves.toBeUndefined();
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it("records both channels when both fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(sms, "send").mockResolvedValue({
      ok: false,
      mocked: false,
      error: "sms bad",
    });
    vi.spyOn(email, "send").mockResolvedValue({
      ok: false,
      mocked: false,
      error: "email bad",
    });

    await notifyNewLead(base);

    expect(auditCreate).toHaveBeenCalledTimes(2);
  });
});
