import Link from "next/link";
import { authMode, getSession } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";
import { ExitViewAsBanner } from "@/components/auth/exit-view-as";
import { ContractorTabs } from "@/components/contractor-tabs";

export const dynamic = "force-dynamic";

/**
 * Contractor shell — phone-first (DESIGN.md §5). Constrained width, calm chrome,
 * a thumb-reachable bottom tab bar. No dense navigation.
 */
export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const clerk = authMode() === "clerk";
  const session = await getSession();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg">
      {session.viewingAs && <ExitViewAsBanner />}
      {clerk && (
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <Link href="/home" className="font-display text-lg font-semibold text-primary">
            Landy&apos;s Pro
          </Link>
          <UserMenu />
        </header>
      )}
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <ContractorTabs />
    </div>
  );
}
