import Link from "next/link";
import { Home, Wallet, User } from "lucide-react";
import { authMode, getSession } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";
import { ExitViewAsBanner } from "@/components/auth/exit-view-as";

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

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-border bg-surface">
        <div className="grid grid-cols-3">
          <TabLink href="/home" icon={<Home className="h-6 w-6" />} label="Leads" />
          <TabLink href="/wallet" icon={<Wallet className="h-6 w-6" />} label="Wallet" />
          <TabLink href="/profile" icon={<User className="h-6 w-6" />} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-tap flex-col items-center justify-center gap-1 py-3 text-text-muted hover:text-primary"
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
