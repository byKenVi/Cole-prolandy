import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function DeactivatedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <BrandLogo className="h-10" priority />
      <div className="max-w-md">
        <h1 className="font-display text-2xl font-semibold text-text">Account deactivated</h1>
        <p className="mt-2 text-base text-text-muted">
          Your contractor account has been deactivated by the Landy&apos;s team. Contact support if
          you believe this is a mistake.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
