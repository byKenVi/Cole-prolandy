import type { CSSProperties } from "react";

/** Secondary action used on the dashboard to-do list (link or button). */
export const todoButtonStyle: CSSProperties = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 36,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--fieldLine)",
  background: "var(--card)",
  color: "var(--ink)",
  font: "600 14px/1 var(--ui)",
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
};
