import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authMode } from "@/lib/auth";

export default function LandingPage() {
  const clerk = authMode() === "clerk";
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="font-display text-3xl font-semibold text-primary">Landy&apos;s Pro</p>
        <p className="mt-3 text-base text-text-muted">
          Land-service leads, delivered to your phone. Pay only for the jobs you want.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {clerk ? (
          <>
            <Button asChild size="cta" variant="accent">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="cta" variant="brand">
              <Link href="/sign-up">Create contractor account</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="cta" variant="accent">
              <Link href="/home">Contractor portal</Link>
            </Button>
            <Button asChild size="cta" variant="brand">
              <Link href="/admin">Admin</Link>
            </Button>
          </>
        )}
        <Button asChild variant="outline">
          <Link href="/estimate">Request an estimate (landowner form)</Link>
        </Button>
      </div>

      {!clerk && (
        <p className="text-center text-xs text-text-muted">
          Dev mode: use the bar at the top to switch between contractor and admin.
        </p>
      )}
    </main>
  );
}
