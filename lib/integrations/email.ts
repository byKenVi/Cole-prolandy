/**
 * Email interface (lead + acceptance notifications). Real Resend drops in behind
 * this interface. Toggle with RESEND_MOCK env.
 */
export type SendEmailParams = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export interface EmailProvider {
  send(params: SendEmailParams): Promise<{ id: string; mocked: boolean }>;
}

const isMock = () => process.env.RESEND_MOCK !== "false"; // default ON

class MockEmailProvider implements EmailProvider {
  async send({ to, subject }: SendEmailParams) {
    const id = `email_mock_${Date.now()}`;
    // eslint-disable-next-line no-console
    console.log(`[email:mock] -> ${to} | ${subject}`);
    return { id, mocked: true };
  }
}

class ResendEmailProvider implements EmailProvider {
  async send({ to, subject, html, text }: SendEmailParams): Promise<{ id: string; mocked: boolean }> {
    void to;
    void subject;
    // TODO(real): implement with Resend.
    //   const { Resend } = await import("resend");
    //   const resend = new Resend(process.env.RESEND_API_KEY);
    //   const res = await resend.emails.send({
    //     from: process.env.RESEND_FROM_EMAIL!, to, subject, html, text,
    //   });
    //   return { id: res.data?.id ?? "", mocked: false };
    void html;
    void text;
    throw new Error(
      "Resend live mode not yet implemented. Set RESEND_MOCK=true or wire ResendEmailProvider.",
    );
  }
}

export const email: EmailProvider = isMock()
  ? new MockEmailProvider()
  : new ResendEmailProvider();
