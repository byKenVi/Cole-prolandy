import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { authMode } from "@/lib/auth";

type InvitationResult =
  | { ok: true; provider: "clerk" | "dev" }
  | { ok: false; error: string };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
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
