/**
 * Email template for admin invitations.
 */
export function buildAdminInviteEmail({
  inviteeName,
  inviterName,
  role,
  inviteUrl,
  expiresAt,
}: {
  inviteeName: string;
  inviterName: string;
  role: "OWNER" | "ADMIN";
  inviteUrl: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  const roleLabel = role === "OWNER" ? "Owner" : "Admin";
  const expiryStr = expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `You've been invited to join Landy's Pro as ${roleLabel === "Owner" ? "an Owner" : "an Admin"}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FEFBF6;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFBF6;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <span style="font-family:Georgia,serif;font-size:34px;color:#5C5142;letter-spacing:-0.01em;">Landys</span>
          <span style="display:inline-block;border:1px solid #C0803C;border-radius:999px;padding:2px 7px;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#C0803C;vertical-align:middle;margin-left:4px;">PRO</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#fff;border:1px solid #EBE3D4;border-radius:18px;padding:36px 40px;box-shadow:0 4px 20px rgba(58,53,45,0.08);">

          <p style="margin:0 0 6px;font-size:22px;font-weight:600;color:#3A352D;font-family:Georgia,serif;">
            You're invited, ${inviteeName}
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#6B6459;line-height:1.6;">
            <strong style="color:#3A352D;">${inviterName}</strong> has invited you to join the
            Landy's Pro admin team as <strong style="color:#3A352D;">${roleLabel}</strong>.
          </p>

          <!-- Role chip -->
          <div style="display:inline-block;background:${role === "OWNER" ? "#F4EAD3" : "#E7F0E9"};border-radius:8px;padding:10px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${role === "OWNER" ? "#8A6B2E" : "#2F6B4A"};">${roleLabel} access</p>
            <p style="margin:4px 0 0;font-size:13px;color:${role === "OWNER" ? "#6B4F1E" : "#1E5A3A"};">
              ${role === "OWNER"
                ? "Full access: manage the team, invite admins, and run the dashboard."
                : "Dashboard access: manage leads, contractors, and settings."}
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin:8px 0 28px;">
            <a href="${inviteUrl}" style="display:inline-block;background:#2F4A3C;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;padding:14px 32px;">
              Accept invitation →
            </a>
          </div>

          <p style="margin:0 0 4px;font-size:13px;color:#8A7E68;">
            This link expires on <strong>${expiryStr}</strong> and can only be used once.
          </p>
          <p style="margin:0;font-size:12px;color:#A79E8D;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#A79E8D;">
            Landy's Pro · Sent on behalf of ${inviterName}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `You've been invited to join Landy's Pro as ${roleLabel}.

${inviterName} has invited you to join the Landy's Pro admin team.

Accept your invitation here:
${inviteUrl}

This link expires on ${expiryStr} and can only be used once.

If you weren't expecting this invitation, you can safely ignore this email.`;

  return { subject, html, text };
}
