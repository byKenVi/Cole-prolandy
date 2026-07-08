import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, authMode } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.role !== "admin") {
    redirect(authMode() === "clerk" ? "/home" : "/");
  }
  const clerk = authMode() === "clerk";

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin" className="font-display text-xl font-semibold text-primary">
            Landy&apos;s Pro · Admin
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <AdminNav />
            {clerk && (
              <span className="ml-2">
                <UserMenu />
              </span>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
