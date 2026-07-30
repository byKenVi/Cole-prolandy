import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { authMode } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";

type InvitationResult =
  | { ok: true; provider: "clerk" | "dev" }
  | { ok: false; error: string };

/**
 * Send an admin invitation via Clerk — same delivery path as contractor invites.
 * The invitation email is sent by Clerk (no custom domain needed). When clicked,
 * the link redirects to /admin/invite?token=<token> where the user accepts.
 */
export async function sendAdminInvitation({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}): Promise<InvitationResult> {
  if (authMode() !== "clerk") return { ok: true, provider: "dev" };

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${appUrl()}/admin/invite?token=${token}`,
      ignoreExisting: true,
      publicMetadata: {
        role: "admin_invite",
        adminInviteToken: token,
        inviteeName: name,
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

/**
 * Send account access immediately after an admin creates a contractor.
 *
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
