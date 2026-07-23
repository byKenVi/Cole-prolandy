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
 * Clerk's OAuth / magic-link redirect where the session cookie hasn't propagated
 * to useAuth yet. A pure Server Component calling auth() would see userId=null
 * and redirect to /sign-in, creating a blank-page loop. Waiting for isLoaded,
 * then briefly retrying while !isSignedIn, eliminates the race.
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

    if (!isSignedIn) {
      // Fresh handshake / ticket exchange can lag isLoaded by a moment.
      // Don't bounce to /sign-in until we've given Clerk a chance to settle.
      const timer = window.setTimeout(() => {
        if (redirected.current) return;
        redirected.current = true;

        const params = window.location.search;
        // If a ticket is still on the URL, finish the flow on sign-in instead
        // of dropping the one-time token.
        if (
          params.includes("__clerk_ticket") ||
          params.includes("__clerk_status") ||
          params.includes("__clerk_db_jwt")
        ) {
          router.replace(`/sign-in${params}`);
          return;
        }

        router.replace("/sign-in");
      }, 2500);

      return () => window.clearTimeout(timer);
    }

    redirected.current = true;

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
