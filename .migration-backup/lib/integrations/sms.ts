/**
 * SMS interface (lead notifications + tokenized accept link).
 *
 * Real delivery is via Twilio. Everything stays behind this interface so callers
 * never care which provider (or mock) is active. Toggle with TWILIO_MOCK.
 *
 * ── Modes ────────────────────────────────────────────────────────────────────
 *   MOCK (development only): logs to console, returns success.
 *   LIVE:           TWILIO_MOCK=false AND creds present. Sends via Twilio SDK.
 *
 * ── Trial-account testing (what we can do TODAY) ─────────────────────────────
 *   The client's production Twilio account isn't ready (US A2P 10DLC pending),
 *   so this is built to work with a Twilio TRIAL account:
 *     - A trial account can only send SMS to numbers you've VERIFIED in the
 *       Twilio Console (Verified Caller IDs). Sending to any other number fails.
 *     - Messages are sent FROM the trial phone number (TWILIO_FROM) and are
 *       prefixed by Twilio with "Sent from your Twilio trial account".
 *   So: verify your own phone in the Console, set TWILIO_FROM to the trial
 *   number, TWILIO_MOCK=false, and you can send real texts to yourself.
 *
 * ── US production note (A2P 10DLC) ───────────────────────────────────────────
 *   For production US A2P traffic the client must register a Messaging Service
 *   + campaign (A2P 10DLC) and provide prod creds. When they do, set
 *   TWILIO_MESSAGING_SERVICE_SID (preferred over a raw from-number) and swap in
 *   the production TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN. No code change needed.
 */
export type SendSmsParams = {
  to: string;
  body: string;
};

/** Structured result — send() NEVER throws raw errors to callers. */
export type SendSmsResult =
  | { ok: true; id: string; mocked: boolean }
  | { ok: false; error: string; mocked: boolean };

export interface SmsProvider {
  send(params: SendSmsParams): Promise<SendSmsResult>;
}

const isMock = () => process.env.TWILIO_MOCK !== "false";

/** Live mode requires both the account SID and auth token to be present. */
function hasTwilioCreds(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/** Real Twilio Messaging Service SIDs look like MGxxxxxxxx (34 chars). */
function validMessagingServiceSid(raw: string | undefined): string | undefined {
  const sid = raw?.trim();
  if (!sid || !/^MG[a-f0-9]{32}$/i.test(sid)) return undefined;
  return sid;
}

export class MockSmsProvider implements SmsProvider {
  async send({ to, body }: SendSmsParams): Promise<SendSmsResult> {
    const id = `sms_mock_${Date.now()}`;

    console.log(`[sms:mock] -> ${to}\n${body}\n`);
    return { ok: true, id, mocked: true };
  }
}

export class TwilioSmsProvider implements SmsProvider {
  async send({ to, body }: SendSmsParams): Promise<SendSmsResult> {
    try {
      // Lazy import so the SDK is only loaded (and only required) in live mode.
      const twilio = (await import("twilio")).default;
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );

      // Sender resolution: prefer a real Messaging Service (prod A2P 10DLC),
      // otherwise use TWILIO_FROM (trial). Ignore placeholders like "MG...".
      const messagingServiceSid = validMessagingServiceSid(
        process.env.TWILIO_MESSAGING_SERVICE_SID,
      );
      const from = process.env.TWILIO_FROM?.trim() || "";
      if (!messagingServiceSid && !from) {
        return {
          ok: false,
          mocked: false,
          error:
            "Twilio sender not configured: set TWILIO_FROM (trial) or a real TWILIO_MESSAGING_SERVICE_SID.",
        };
      }

      const msg = await client.messages.create({
        to,
        body,
        ...(messagingServiceSid
          ? { messagingServiceSid }
          : { from }),
      });

      return { ok: true, id: msg.sid, mocked: false };
    } catch (err) {
      // Never leak a raw error to the caller — normalize to a string. Common
      // trial-account failure: recipient number isn't a Verified Caller ID.
      const error = err instanceof Error ? err.message : String(err);
      return { ok: false, mocked: false, error };
    }
  }
}

function createSmsProvider(): SmsProvider {
  if (isMock()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error('TWILIO_MOCK must be explicitly set to "false" in production.');
    }
    return new MockSmsProvider();
  }
  if (!hasTwilioCreds()) {
    throw new Error("Twilio credentials are required when TWILIO_MOCK=false.");
  }
  return new TwilioSmsProvider();
}

export const sms: SmsProvider = createSmsProvider();
