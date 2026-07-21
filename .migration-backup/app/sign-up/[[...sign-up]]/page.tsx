import { SignUp } from "@clerk/nextjs";
import { authMode } from "@/lib/auth";

export default function SignUpPage() {
  if (authMode() !== "clerk") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-base text-text-muted">
          Auth is in dev mode. Set <code>AUTH_MODE=clerk</code> and add Clerk keys to enable sign-up.
        </p>
      </main>
    );
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <SignUp forceRedirectUrl="/post-auth" fallbackRedirectUrl="/post-auth" />
    </main>
  );
}
