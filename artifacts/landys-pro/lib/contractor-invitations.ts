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
 * The invitee has no account yet, so the link MUST land on /sign-up: Clerk's
 * <SignUp/> consumes the __clerk_ticket there, locks the invited address and
 * asks only for a password. Pointing it at /admin/invite instead sent people
 * who were not signed in to /sign-in, where signing in fails with "account not
 * found" because the account does not exist yet.
 *
 * /sign-up is also exactly what the api-server's ticket/accept short-circuit
 * redirects to (it cannot know the invitation's own redirectUrl), so the
 * proxied and direct Clerk paths now land in the same place.
 *
 * Admin rights are not carried by this URL at all: they are claimed from the
 * invitee's Clerk-verified email on first sign-in — see claimPendingAdminInvite
 * in lib/admin-invites.ts. `inviteUrl` below is only the manual acceptance page,
 * used for someone who already has an account.
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
      redirectUrl: `${appUrl()}/sign-up`,
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
