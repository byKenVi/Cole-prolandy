import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { authMode } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { email as emailService } from "@/lib/integrations/email";

export type InvitationResult =
  | { ok: true; provider: "resend" | "clerk" | "dev" }
  | { ok: false; error: string };

// ── Admin invitation (via Resend) ─────────────────────────────────────────────

/**
 * Send an admin invitation email via Resend.
 * Uses the Replit-managed Resend connector (no API key / custom domain needed).
 */
export async function sendAdminInvitation({
  email: emailAddress,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}): Promise<InvitationResult> {
  const inviteUrl = `${appUrl()}/admin/invite?token=${token}`;
  console.log("[admin-invite] sending invitation to", emailAddress, "url:", inviteUrl);

  const result = await emailService.send({
    to: emailAddress,
    subject: "You've been invited to join Landy's Pro",
    html: buildAdminInviteEmail({ name, inviteUrl }),
    text: `Hi ${name},\n\nYou've been invited to join Landy's Pro as an administrator.\n\nAccept your invitation here:\n${inviteUrl}\n\nThis link expires in 7 days.`,
  });

  if (result.ok) {
    console.log("[admin-invite] email sent OK — id:", result.id, "mocked:", result.mocked);
    return { ok: true, provider: result.mocked ? "dev" : "resend" };
  } else {
    console.error("[admin-invite] email FAILED for", emailAddress, ":", result.error);
    return { ok: false, error: result.error };
  }
}

function buildAdminInviteEmail({
  name,
  inviteUrl,
}: {
  name: string;
  inviteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo / brand -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-size:22px;font-weight:700;color:#2F4A3C;letter-spacing:-.02em;">
                Landy's Pro
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:18px;padding:40px 36px;box-shadow:0 4px 24px rgba(47,74,60,.08);">

              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A2E24;line-height:1.2;">
                You're invited, ${name} 👋
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#5A7A6A;line-height:1.6;">
                You've been invited to join <strong style="color:#2F4A3C;">Landy's Pro</strong>
                as an administrator. Click the button below to accept your invitation and set up your
                account.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#2F4A3C;border-radius:12px;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-.01em;">
                      Accept invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:13px;color:#8A9E94;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#2F4A3C;word-break:break-all;">
                ${inviteUrl}
              </p>

              <hr style="border:none;border-top:1px solid #E8EDE9;margin:0 0 20px;" />

              <p style="margin:0;font-size:12px;color:#8A9E94;line-height:1.6;">
                This invitation expires in <strong>7 days</strong>. If you weren't expecting this
                email, you can safely ignore it.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9A9E98;">
                Landy's Pro · Sent via Resend
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Contractor invitation (via Clerk — unchanged) ─────────────────────────────

/**
 * Send account access immediately after an admin creates a contractor.
 * Clerk sends the invitation even when the email already has an account or a
 * previous pending invite (ignoreExisting), so account access never depends on
 * the separate lead-notification email provider.
 */
export async function sendContractorAccountInvitation(
  contractor: { name: string; email: string },
): Promise<InvitationResult> {
  if (authMode() !== "clerk") return { ok: true, provider: "dev" };

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: contractor.email,
      redirectUrl: `${appUrl()}/sign-up`,
      ignoreExisting: true,
      publicMetadata: {
        role: "contractor",
        contractorName: contractor.name,
      },
    });
    return { ok: true, provider: "clerk" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
