"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inviteAdmin } from "@/app/actions/team";

/** Selected-state colours. Literal values: the dialog portals outside `.admin-theme`. */
const ACCENT = "#2F5340";
const ACCENT_SOFT = "rgba(47, 83, 64, 0.08)";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
  color: "var(--ink, #3A352D)",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  border: "1px solid var(--line, #EBE3D4)",
  borderRadius: 10,
  /* 16px keeps iOS Safari from zooming the viewport when the field is focused. */
  fontSize: 16,
  color: "var(--ink, #3A352D)",
  background: "var(--surface, #FBF6EC)",
  outline: "none",
  boxSizing: "border-box",
};

export function InviteAdminModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string, severity: "success" | "warning") => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OWNER">("ADMIN");

  function handleClose() {
    if (pending) return;
    onClose();
    setTimeout(() => {
      setName("");
      setEmail("");
      setRole("ADMIN");
      setError(null);
    }, 250);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!email.trim() || !email.includes("@")) return setError("A valid email is required.");

    startTransition(async () => {
      const res = await inviteAdmin({ name: name.trim(), email: email.trim(), role });
      if (res.ok) {
        onSuccess(res.message ?? "Invitation sent.", res.severity ?? "success");
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent showClose={!pending}>
        <DialogHeader>
          <DialogTitle>Invite administrator</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label
              htmlFor="invite-name"
              style={labelStyle}
            >
              Full name
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              disabled={pending}
              autoComplete="name"
              autoFocus
              style={fieldStyle}
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="invite-email"
              style={labelStyle}
            >
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              disabled={pending}
              autoComplete="email"
              inputMode="email"
              style={fieldStyle}
            />
          </div>

          {/* Role — a real radio group, so the whole card is a click target and
              arrow keys work. The dialog renders in a portal outside
              `.admin-theme`, so every colour needs a literal fallback. */}
          <fieldset style={{ margin: 0, padding: 0, border: "none" }}>
            <legend
              style={{
                padding: 0,
                margin: "0 0 8px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink, #3A352D)",
              }}
            >
              Role
            </legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(["ADMIN", "OWNER"] as const).map((r) => {
                const selected = role === r;
                return (
                  <label
                    key={r}
                    htmlFor={`invite-role-${r}`}
                    style={{
                      position: "relative",
                      flex: "1 1 140px",
                      minWidth: 0,
                      padding: "12px 12px 12px 34px",
                      borderRadius: 12,
                      border: `2px solid ${selected ? ACCENT : "var(--line, #EBE3D4)"}`,
                      background: selected ? ACCENT_SOFT : "var(--surface, #FBF6EC)",
                      cursor: pending ? "not-allowed" : "pointer",
                      display: "block",
                      userSelect: "none",
                      transition: "border-color .12s, background .12s",
                    }}
                  >
                    <input
                      id={`invite-role-${r}`}
                      type="radio"
                      name="invite-role"
                      value={r}
                      checked={selected}
                      disabled={pending}
                      onChange={() => setRole(r)}
                      style={{
                        position: "absolute",
                        top: 15,
                        left: 12,
                        width: 15,
                        height: 15,
                        margin: 0,
                        accentColor: ACCENT,
                        cursor: pending ? "not-allowed" : "pointer",
                      }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: selected ? ACCENT : "var(--ink, #3A352D)",
                      }}
                    >
                      {r === "OWNER" ? "Owner" : "Admin"}
                    </p>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 11,
                        color: "var(--ink2, #6B6459)",
                        lineHeight: 1.4,
                      }}
                    >
                      {r === "OWNER"
                        ? "Full team management + dashboard"
                        : "Dashboard access only"}
                    </p>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#9A3B2E",
                background: "#F6E4E1",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={pending}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={pending}
              disabled={pending}
              style={{ flex: 2 }}
            >
              Send invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
