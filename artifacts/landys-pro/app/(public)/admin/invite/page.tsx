"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/app/actions/team";

/**
 * Public invitation acceptance page.
 * Works in two states:
 *   • Not signed in  → Show "Sign in to accept" CTA that sends user through
 *                       Clerk sign-in with a returnTo back to this URL.
 *   • Signed in      → Show invitation details + "Accept" button.
 *                       Server action creates the AdminUser record.
 */
export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <InviteCard icon={<Clock style={{ color: "var(--ink2)" }} />} title="Loading…">
          <p style={bodyStyle}>Please wait a moment.</p>
        </InviteCard>
      }
    >
      <InvitePageInner />
    </Suspense>
  );
}

function InvitePageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "accepted" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [pending, startTransition] = useTransition();

  // Detect sign-in state via Clerk's client-side hook (avoids the api-server
  // proxy, which intercepts all /api/* calls before they reach Next.js).
  // isLoaded: false means Clerk JS hasn't initialized yet.
  const { isLoaded, isSignedIn: clerkSignedIn } = useAuth();
  const signedIn = isLoaded ? (clerkSignedIn ?? false) : null;

  // No token: not an error. Access is also granted from the pending invitation
  // matching the signed-in user's verified email, so point them at sign-in
  // rather than showing a dead end.
  if (!token) {
    return (
      <InviteCard icon={<CheckCircle2 style={{ color: "#2F6B4A" }} />} title="Accept your invitation">
        <p style={bodyStyle}>
          Sign in with the email address your invitation was sent to. Your admin access is applied
          automatically the first time you sign in.
        </p>
        <Button
          variant="accent"
          onClick={() => router.push(signedIn ? "/admin" : "/sign-in")}
          style={{ width: "100%", marginTop: 8 }}
        >
          {signedIn ? "Go to dashboard →" : "Sign in →"}
        </Button>
      </InviteCard>
    );
  }

  if (state.status === "accepted") {
    return (
      <InviteCard icon={<CheckCircle2 style={{ color: "#2F6B4A" }} />} title="You're in!">
        <p style={bodyStyle}>Your invitation was accepted. Sign in to access the admin dashboard.</p>
        <Button variant="accent" onClick={() => router.push("/admin")} style={{ width: "100%", marginTop: 16 }}>
          Go to dashboard →
        </Button>
      </InviteCard>
    );
  }

  if (state.status === "error") {
    return (
      <InviteCard icon={<AlertTriangle style={{ color: "#C0803C" }} />} title="Something went wrong">
        <p style={bodyStyle}>{state.message}</p>
        <Button variant="ghost" onClick={() => router.push("/sign-in")} style={{ width: "100%", marginTop: 16 }}>
          Sign in instead
        </Button>
      </InviteCard>
    );
  }

  if (signedIn === null) {
    // Loading state while we check session.
    return (
      <InviteCard icon={<Clock style={{ color: "var(--ink2)" }} />} title="Checking invitation…">
        <p style={bodyStyle}>Please wait a moment.</p>
      </InviteCard>
    );
  }

  // Not signed in. Most invitees have no account yet, so lead with sign-up —
  // sending them to sign-in first fails with "account not found". Either way the
  // invitation is claimed from their verified email once they land on /post-auth.
  if (!signedIn) {
    const returnTo = encodeURIComponent(`/admin/invite?token=${token}`);
    return (
      <InviteCard icon={<CheckCircle2 style={{ color: "#2F6B4A" }} />} title="You've been invited">
        <p style={bodyStyle}>
          Create your account to accept the invitation and reach the Landy&apos;s Pro admin
          dashboard. Use the email address the invitation was sent to.
        </p>
        <Button
          variant="accent"
          onClick={() => router.push(`/sign-up?redirect_url=${returnTo}`)}
          style={{ width: "100%", marginTop: 8 }}
        >
          Create my account →
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push(`/sign-in?redirect_url=${returnTo}`)}
          style={{ width: "100%", marginTop: 8 }}
        >
          I already have an account
        </Button>
      </InviteCard>
    );
  }

  // Signed-in state: show the accept button.
  function handleAccept() {
    startTransition(async () => {
      setState({ status: "loading" });
      const res = await acceptInvitation(token);
      if (res.ok) {
        setState({ status: "accepted" });
      } else {
        setState({ status: "error", message: res.message });
      }
    });
  }

  return (
    <InviteCard icon={<CheckCircle2 style={{ color: "#2F6B4A" }} />} title="Accept your invitation">
      <p style={bodyStyle}>
        You&apos;ve been invited to join the Landy&apos;s Pro admin team. Click below to accept.
      </p>
      <Button
        variant="accent"
        onClick={handleAccept}
        loading={pending || state.status === "loading"}
        disabled={pending || state.status === "loading"}
        style={{ width: "100%", marginTop: 8 }}
      >
        Accept invitation
      </Button>
    </InviteCard>
  );
}

// ─── Shared card wrapper ───────────────────────────────────────────────────────

function InviteCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface, #FEFBF6)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--card, #fff)",
          border: "1px solid var(--line, #EBE3D4)",
          borderRadius: 20,
          boxShadow: "0 8px 32px rgba(58,53,45,0.10)",
          padding: "36px 40px",
        }}
      >
        {/* Branding */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "'Great Vibes', Georgia, serif",
              fontSize: 32,
              color: "#5C5142",
              lineHeight: 1,
            }}
          >
            Landys
          </span>
          <span
            style={{
              border: "1px solid #C0803C",
              borderRadius: 999,
              padding: "2px 7px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#C0803C",
            }}
          >
            PRO
          </span>
        </div>

        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {icon}
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: "var(--ink, #3A352D)",
              letterSpacing: "-.01em",
            }}
          >
            {title}
          </h1>
        </div>

        {children}
      </div>
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 15,
  color: "var(--ink2, #6B6459)",
  lineHeight: 1.6,
};
