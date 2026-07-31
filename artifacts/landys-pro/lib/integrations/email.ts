/**
 * Email interface (lead + acceptance notifications).
 *
 * Provider priority:
 *   1. Replit-managed Resend connector  — no API key or domain needed
 *   2. Direct Resend SDK                — requires RESEND_API_KEY + RESEND_FROM
 *   3. Mock                             — logs to console (RESEND_MOCK=true or no creds)
 *
 * The Replit connector uses onboarding@resend.dev as the sender, which is a
 * verified domain built into every Resend account — no custom domain required.
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

// ── Mock ─────────────────────────────────────────────────────────────────────

export class MockEmailProvider implements EmailProvider {
  async send({ to, subject }: SendEmailParams): Promise<SendEmailResult> {
    console.log(`[email:mock] -> ${to} | ${subject}`);
    return { ok: true, id: `email_mock_${Date.now()}`, mocked: true };
  }
}

/**
 * Production stand-in for the mock. Reporting `ok: true` when nothing was sent
 * is the worst outcome: callers record a successful notification and nobody
 * finds out the mail never left. Stripe and SMS already refuse to run mocked in
 * production; this does the same, but as a failed result rather than a throw so
 * the existing per-send error handling reports it instead of breaking the
 * request that triggered it.
 */
export class UnconfiguredEmailProvider implements EmailProvider {
  async send({ to, subject }: SendEmailParams): Promise<SendEmailResult> {
    const error =
      "Email is not configured in production. Set RESEND_MOCK=false with a Resend " +
      "connector or RESEND_API_KEY.";
    console.error(`[email] REFUSED -> ${to} | ${subject} — ${error}`);
    return { ok: false, error, mocked: false };
  }
}

// ── Replit connector (preferred) ─────────────────────────────────────────────

export class ReplitResendProvider implements EmailProvider {
  /** onboarding@resend.dev is a verified sender on every Resend account. */
  private readonly from =
    process.env.RESEND_FROM?.trim() || "Landy's Pro <onboarding@resend.dev>";

  async send({ to, subject, html, text }: SendEmailParams): Promise<SendEmailResult> {
    try {
      const { ReplitConnectors } = await import("@replit/connectors-sdk");
      const connectors = new ReplitConnectors();

      const body: Record<string, unknown> = {
        from: this.from,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(!html && !text ? { text: subject } : {}),
      };

      const res = await connectors.proxy("resend", "/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        return { ok: false, mocked: false, error: errText };
      }

      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (data.error) {
        return { ok: false, mocked: false, error: data.error.message };
      }
      return { ok: true, id: data.id ?? "", mocked: false };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { ok: false, mocked: false, error };
    }
  }
}

// ── Direct Resend SDK (fallback when no connector) ───────────────────────────

export class ResendEmailProvider implements EmailProvider {
  async send({ to, subject, html, text }: SendEmailParams): Promise<SendEmailResult> {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const from = process.env.RESEND_FROM?.trim();
      if (!from) {
        return { ok: false, mocked: false, error: "RESEND_FROM is not set." };
      }

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
      const error = err instanceof Error ? err.message : String(err);
      return { ok: false, mocked: false, error };
    }
  }
}

// ── Provider selection ────────────────────────────────────────────────────────

/** Returns true when running inside a Replit environment (connector available). */
function isReplitEnv(): boolean {
  return Boolean(process.env.REPL_ID);
}

function isMock(): boolean {
  // Explicit opt-out → never mock
  if (process.env.RESEND_MOCK === "false") return false;
  // Explicit opt-in → always mock
  if (process.env.RESEND_MOCK === "true") return true;
  // Default: mock unless we're in a Replit env (connector available) or have direct creds
  return !isReplitEnv() && !process.env.RESEND_API_KEY;
}

function createEmailProvider(): EmailProvider {
  if (isMock()) {
    if (process.env.NODE_ENV === "production") {
      return new UnconfiguredEmailProvider();
    }
    return new MockEmailProvider();
  }
  // Prefer the Replit-managed connector when running on Replit
  if (isReplitEnv()) {
    return new ReplitResendProvider();
  }
  // Local dev with a direct API key
  return new ResendEmailProvider();
}

// Lazy singleton so the provider isn't constructed during Next.js build phase.
let _emailProvider: EmailProvider | null = null;
function getEmailProvider(): EmailProvider {
  if (!_emailProvider) _emailProvider = createEmailProvider();
  return _emailProvider;
}

export const email: EmailProvider = {
  send: (params) => getEmailProvider().send(params),
};
