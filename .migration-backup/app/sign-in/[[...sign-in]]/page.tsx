import { SignIn } from "@clerk/nextjs";
import { authMode } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";

export default function SignInPage() {
  if (authMode() !== "clerk") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-base text-text-muted">
          Auth is in dev mode. Set <code>AUTH_MODE=clerk</code> and add Clerk keys to enable sign-in.
        </p>
      </main>
    );
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <BrandLogo className="h-10" priority />
      <SignIn forceRedirectUrl="/post-auth" fallbackRedirectUrl="/post-auth" />
    </main>
  );
}
