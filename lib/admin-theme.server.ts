import { cookies } from "next/headers";
import { ADMIN_THEME_COOKIE, type AdminTheme } from "@/lib/admin-theme";

/** Read the persisted admin theme (defaults to Light). Server-only. */
export async function getAdminTheme(): Promise<AdminTheme> {
  const jar = await cookies();
  return jar.get(ADMIN_THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
