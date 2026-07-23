"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getPostAuthRedirect } from "@/app/actions/auth";

/**
 * Post-login router — runs on the CLIENT so the Clerk session is guaranteed
 * to be loaded before we ask the server where to send the user.
 *
 * Problem solved: in the Replit proxy environment there is a brief window after
 * Clerk's OAuth redirect where the session cookie hasn't propagated to the
 * server yet. A pure Server Component calling auth() would see userId=null and
 * redirect to /sign-in, creating a blank-page loop. Moving the wait to the
 * client (useAuth isLoaded) eliminates the race, and the spinner gives the
 * user visible feedback instead of a blank page.
 *
 * Uses a server action (not an API route) because the Replit proxy routes
 * all /api/* traffic to the api-server artifact, not this Next.js app.
 */
export default function PostAuthPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (!isLoaded || redirected.current) return;
    redirected.current = true;

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    // Auth confirmed on the client — call a server action for the destination.
    getPostAuthRedirect()
      .then((destination) => router.replace(destination))
      .catch(() => router.replace("/home"));
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#FAF7F4]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#C4A882] border-t-transparent" />
        <p className="text-sm text-[#8A7E68]">Signing in…</p>
      </div>
    </div>
  );
}
