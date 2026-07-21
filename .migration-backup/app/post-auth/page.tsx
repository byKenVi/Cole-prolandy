import { redirect } from "next/navigation";
import { authMode, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Post-login router. Clerk lands here after sign-in/sign-up so admins go to
 * /admin and contractors to /home — no manual URL typing required.
 */
export default async function PostAuthPage() {
  if (authMode() !== "clerk") redirect("/home");

  const session = await getSession();
  if (!session.userId) redirect("/sign-in");

  if (session.role === "admin") redirect("/admin");
  if (session.deactivated) redirect("/deactivated");
  if (session.needsOnboarding) redirect("/profile");
  redirect("/home");
}
