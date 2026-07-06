import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { DevBarClient } from "./dev-bar-client";

/**
 * DEV-only toolbar to switch roles / active contractor without real auth.
 * Rendered only when AUTH_MODE=dev. Not present once Clerk is wired.
 */
export async function DevBar() {
  let session;
  let contractors: { id: string; name: string }[] = [];
  try {
    session = await getSession();
    contractors = await prisma.contractor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch {
    // DB not reachable yet (e.g. before migrate/seed) — render a minimal bar.
    return (
      <div className="w-full bg-primary px-4 py-2 text-center text-xs text-white/90">
        Dev mode · database not connected yet — run migrations + seed
      </div>
    );
  }

  return (
    <DevBarClient
      role={session.role}
      contractorId={session.contractorId}
      viewingAs={session.viewingAs}
      contractors={contractors}
    />
  );
}
