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

export function InviteAdminModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
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
        onSuccess(res.message ?? "Invitation sent.");
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
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}
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
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 10,
                fontSize: 14,
                color: "var(--ink)",
                background: "var(--surface)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="invite-email"
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}
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
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 10,
                fontSize: 14,
                color: "var(--ink)",
                background: "var(--surface)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Role */}
          <div>
            <label
              style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--ink)" }}
            >
              Role
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              {(["ADMIN", "OWNER"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  disabled={pending}
                  style={{
                    flex: 1,
                    padding: "12px 10px",
                    borderRadius: 12,
                    border: `2px solid ${role === r ? "var(--green)" : "var(--line)"}`,
                    background: role === r ? "color-mix(in srgb, var(--green) 10%, transparent)" : "var(--surface)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: role === r ? "var(--green)" : "var(--ink)" }}>
                    {r === "OWNER" ? "Owner" : "Admin"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--ink2)", lineHeight: 1.4 }}>
                    {r === "OWNER"
                      ? "Full team management + dashboard"
                      : "Dashboard access only"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "#9A3B2E", background: "#F6E4E1", borderRadius: 8, padding: "8px 12px" }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={pending} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={pending} disabled={pending} style={{ flex: 2 }}>
              Send invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
