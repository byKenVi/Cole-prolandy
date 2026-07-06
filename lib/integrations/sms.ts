/**
 * SMS interface (lead notifications + tokenized accept link). Real Twilio drops
 * in behind this interface. Toggle with TWILIO_MOCK env.
 */
export type SendSmsParams = {
  to: string;
  body: string;
};

export interface SmsProvider {
  send(params: SendSmsParams): Promise<{ id: string; mocked: boolean }>;
}

const isMock = () => process.env.TWILIO_MOCK !== "false"; // default ON

class MockSmsProvider implements SmsProvider {
  async send({ to, body }: SendSmsParams) {
    const id = `sms_mock_${Date.now()}`;
    // eslint-disable-next-line no-console
    console.log(`[sms:mock] -> ${to}\n${body}\n`);
    return { id, mocked: true };
  }
}

class TwilioSmsProvider implements SmsProvider {
  async send({ to, body }: SendSmsParams): Promise<{ id: string; mocked: boolean }> {
    void to;
    void body;
    // TODO(real): implement with Twilio.
    //   const twilio = (await import("twilio")).default;
    //   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    //   const msg = await client.messages.create({
    //     to, from: process.env.TWILIO_FROM_NUMBER,
    //     messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID, body,
    //   });
    //   return { id: msg.sid, mocked: false };
    throw new Error(
      "Twilio live mode not yet implemented. Set TWILIO_MOCK=true or wire TwilioSmsProvider.",
    );
  }
}

export const sms: SmsProvider = isMock()
  ? new MockSmsProvider()
  : new TwilioSmsProvider();
