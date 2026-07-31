import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { authMode } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";

export type InvitationResult =
  | { ok: true; provider: "clerk" | "dev"; note?: InvitationNote; inviteUrl?: string }
  | { ok: false; error: string };

/** Non-fatal outcomes the caller should tell the inviter about. */
export type InvitationNote = "existing-account" | "dev-no-email";

// ── Admin invitation (via Clerk) ──────────────────────────────────────────────

/**
 * Clerk rejects an invitation when the address already has an account or a
 * live invite. That is not a failure here: admin access is granted from the
 * pending AdminInvite the moment the person signs in, so the invite still
 * works — the inviter just needs different wording.
 */
function isAlreadyKnownToClerk(error: unknown): boolean {
  const codes = new Set([
    "duplicate_record",
    "form_identifier_exists",
    "identifier_already_signed_up",
  ]);

  const errors = (error as { errors?: { code?: string }[] })?.errors;
  if (Array.isArray(errors) && errors.some((e) => e.code && codes.has(e.code))) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /already (exists|signed up|a member)|duplicate/i.test(message);
}

/**
 * Send an admin invitation through Clerk — the same delivery path contractor
 * invitations use. Clerk owns the mailbox reputation, so this needs no verified
 * sending domain of our own.
 *
 * `redirectUrl` carries the acceptance token, but do not rely on it arriving:
 * in production the api-server short-circuits Clerk's ticket/accept endpoint to
 * dodge a Cloudflare bot challenge, and that discards the redirect. Acceptance
 * therefore also resolves from the invitee's Clerk-verified email — see
 * claimPendingAdminInvite in lib/admin-invites.ts.
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

  if (authMode() !== "clerk") {
    console.log("[admin-invite] dev mode — no email sent. Accept via:", inviteUrl);
    return { ok: true, provider: "dev", note: "dev-no-email", inviteUrl };
  }

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress,
      redirectUrl: inviteUrl,
      ignoreExisting: true,
      publicMetadata: { role: "admin", adminName: name },
    });
    return { ok: true, provider: "clerk" };
  } catch (error) {
    if (isAlreadyKnownToClerk(error)) {
      return { ok: true, provider: "clerk", note: "existing-account", inviteUrl };
    }
    console.error("[admin-invite] Clerk invitation failed for", emailAddress, ":", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
