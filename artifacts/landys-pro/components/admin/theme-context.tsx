"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { AdminTheme } from "@/lib/admin-theme";
import { ADMIN_THEME_COOKIE } from "@/lib/admin-theme";

type ThemeCtx = {
  theme: AdminTheme;
  setTheme: (t: AdminTheme) => void;
  toggle: () => void;
};

const AdminThemeContext = createContext<ThemeCtx | null>(null);

/**
 * Client provider that owns the admin theme. It is initialised from the
 * server-read cookie (so first paint already matches), and on change it writes
 * the DOM attribute (via React state on the shell root) and persists the cookie
 * for one year.
 */
export function AdminThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: AdminTheme;
  children: (theme: AdminTheme) => React.ReactNode;
}) {
  const [theme, setThemeState] = useState<AdminTheme>(initialTheme);

  const setTheme = useCallback((t: AdminTheme) => {
    setThemeState(t);
    document.cookie = `${ADMIN_THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.cookie = `${ADMIN_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <AdminThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children(theme)}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): ThemeCtx {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error("useAdminTheme must be used within AdminThemeProvider");
  return ctx;
}
