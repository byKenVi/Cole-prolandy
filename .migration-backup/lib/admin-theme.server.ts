import { cookies } from "next/headers";
import { ADMIN_SIDEBAR_COOKIE, ADMIN_THEME_COOKIE, type AdminTheme } from "@/lib/admin-theme";

/** Read the persisted admin theme (defaults to Light). Server-only. */
export async function getAdminTheme(): Promise<AdminTheme> {
  const jar = await cookies();
  return jar.get(ADMIN_THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}

/** Read the persisted sidebar collapsed preference (defaults to expanded). */
export async function getAdminSidebarCollapsed(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(ADMIN_SIDEBAR_COOKIE)?.value === "collapsed";
}
