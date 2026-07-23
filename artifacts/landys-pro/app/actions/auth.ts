"use server";

import { getSession, authMode } from "@/lib/auth";

/**
 * Returns the URL the user should land on after a successful Clerk sign-in.
 *
 * Called as a server action from the client-side /post-auth page so we avoid
 * the Replit proxy routing /api/* to the api-server artifact instead of Next.js.
 */
export async function getPostAuthRedirect(): Promise<string> {
  if (authMode() !== "clerk") return "/home";

  const session = await getSession();
  if (!session.userId) return "/sign-in";
  if (session.role === "admin") return "/admin";
  if (session.deactivated) return "/deactivated";
  if (session.needsOnboarding) return "/profile";
  return "/home";
}
