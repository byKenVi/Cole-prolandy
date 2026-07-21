/**
 * Email interface (lead + acceptance notifications).
 *
 * Real delivery is via Resend. Everything stays behind this interface so callers
 * never care which provider (or mock) is active. Toggle with RESEND_MOCK.
 *
 * ── Modes ────────────────────────────────────────────────────────────────────
 *   MOCK (development only): logs to console, returns success.
 *   LIVE:           RESEND_MOCK=false AND RESEND_API_KEY present. Sends via SDK.
 *
 * ── Testing today ────────────────────────────────────────────────────────────
 *   Resend has no "trial-only" restriction like Twilio, but the FROM address
 *   (RESEND_FROM) must be on a domain you've verified in Resend (or use their
 *   onboarding@resend.dev sandbox sender for quick tests).
 */
export type SendEmailParams = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

/** Structured result — send() NEVER throws raw errors to callers. */
export type SendEmailResult =
  | { ok: true; id: string; mocked: boolean }
  | { ok: false; error: string; mocked: boolean };

export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

const isMock = () => process.env.RESEND_MOCK !== "false";

function resendFrom(): string | undefined {
  return process.env.RESEND_FROM?.trim();
}

/** Live mode requires both the API key and a verified sender. */
function hasResendCreds(): boolean {
  return Boolean(process.env.RESEND_API_KEY && resendFrom());
}

export class MockEmailProvider implements EmailProvider {
  async send({ to, subject }: SendEmailParams): Promise<SendEmailResult> {
    const id = `email_mock_${Date.now()}`;

    console.log(`[email:mock] -> ${to} | ${subject}`);
    return { ok: true, id, mocked: true };
  }
}

export class ResendEmailProvider implements EmailProvider {
  async send({ to, subject, html, text }: SendEmailParams): Promise<SendEmailResult> {
    try {
      // Lazy import so the SDK is only loaded (and only required) in live mode.
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const from = resendFrom();
      if (!from) {
        return {
          ok: false,
          mocked: false,
          error: "Resend sender not configured: set RESEND_FROM.",
        };
      }

      // Resend requires at least one of html/text; fall back to the subject.
      const res = await resend.emails.send({
        from,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(!html && !text ? { text: subject } : {}),
      } as Parameters<typeof resend.emails.send>[0]);

      if (res.error) {
        return { ok: false, mocked: false, error: res.error.message };
      }
      return { ok: true, id: res.data?.id ?? "", mocked: false };
    } catch (err) {
      // Never leak a raw error to the caller — normalize to a string.
      const error = err instanceof Error ? err.message : String(err);
      return { ok: false, mocked: false, error };
    }
  }
}

function createEmailProvider(): EmailProvider {
  if (isMock()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error('RESEND_MOCK must be explicitly set to "false" in production.');
    }
    return new MockEmailProvider();
  }
  if (!hasResendCreds()) {
    throw new Error("Resend credentials and RESEND_FROM are required when RESEND_MOCK=false.");
  }
  return new ResendEmailProvider();
}

export const email: EmailProvider = createEmailProvider();
