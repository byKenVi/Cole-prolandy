"use client";

import { useAdminTheme } from "@/components/admin/theme-context";

/**
 * Settings "Appearance" picker — the second control (besides the topbar toggle)
 * for the admin light/dark theme. Both read/write the same provider state and
 * cookie, so they always agree.
 */
export function AppearancePicker() {
  const { theme, setTheme } = useAdminTheme();

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button
        type="button"
        onClick={() => setTheme("light")}
        style={{
          flex: 1,
          cursor: "pointer",
          padding: 16,
          borderRadius: 14,
          border: `2px solid ${theme === "light" ? "var(--gold)" : "var(--line)"}`,
          background: "#FBF6EC",
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "block",
            height: 34,
            borderRadius: 8,
            background: "linear-gradient(#fff,#FEFBF6)",
            border: "1px solid #E9E1D2",
            marginBottom: 11,
          }}
        />
        <span style={{ font: "600 13px/1 'Inter'", color: "#3A352D" }}>Light</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        style={{
          flex: 1,
          cursor: "pointer",
          padding: 16,
          borderRadius: 14,
          border: `2px solid ${theme === "dark" ? "var(--gold)" : "var(--line)"}`,
          background: "#241F18",
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "block",
            height: 34,
            borderRadius: 8,
            background: "linear-gradient(#2A261E,#17140F)",
            border: "1px solid #38332A",
            marginBottom: 11,
          }}
        />
        <span style={{ font: "600 13px/1 'Inter'", color: "#F1E7D6" }}>Dark</span>
      </button>
    </div>
  );
}
