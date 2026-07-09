/**
 * Admin panel light/dark theme — client-safe constants and types.
 *
 * The choice is persisted in a cookie so it survives reloads AND is readable on
 * the server: the admin layout reads it (see `getAdminTheme` in
 * `lib/admin-theme.server.ts`) to set the initial `data-theme` on the shell
 * root, which avoids a flash of the wrong theme on SSR. A small client toggle
 * updates the attribute in the DOM and rewrites this same cookie.
 *
 * This is purely visual admin state — it touches no money/wallet/lead logic.
 * NOTE: keep this module free of server-only imports (e.g. next/headers) so it
 * can be safely imported by client components.
 */
export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_COOKIE = "lp_admin_theme";
