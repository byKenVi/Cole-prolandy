"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { UserPlus, MoreHorizontal, RefreshCw, Ban, CheckCircle2, Trash2, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteAdminModal } from "@/components/admin/invite-modal";
import {
  disableAdmin,
  enableAdmin,
  removeAdmin,
  changeAdminRole,
  revokeInvite,
  resendInvite,
} from "@/app/actions/team";
import { formatDate } from "@/lib/format";

// ─── Types passed in from the server page wrapper ──────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN";
  status: "active" | "disabled";
  invitedAt: Date;
  lastLoginAt: Date | null;
  isSelf: boolean;
};

export type PendingInvite = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN";
  invitedAt: Date;
  expiresAt: Date;
};

// ─── Shared card/table style values ───────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 18,
  boxShadow: "var(--shadow)",
  overflow: "hidden",
};

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "var(--ink2)",
  textAlign: "left",
  background: "color-mix(in srgb, var(--surface) 80%, transparent)",
  borderBottom: "1px solid var(--line)",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 14,
  color: "var(--ink)",
  borderBottom: "1px solid var(--line)",
  verticalAlign: "middle",
};

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "disabled" | "pending" | "expired" }) {
  const cfg = {
    active: { bg: "#E7F0E9", color: "#2F6B4A", label: "Active" },
    disabled: { bg: "#F6E4E1", color: "#9A3B2E", label: "Disabled" },
    pending: { bg: "#F4EAD3", color: "#8A6B2E", label: "Invitation Pending" },
    expired: { bg: "#F1EBDF", color: "#9A7E58", label: "Expired" },
  }[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "OWNER" | "ADMIN" }) {
  return role === "OWNER" ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#C0803C" }}>
      <Crown style={{ width: 13, height: 13 }} /> Owner
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink2)" }}>
      <Shield style={{ width: 13, height: 13 }} /> Admin
    </span>
  );
}

// ─── Row action menu ───────────────────────────────────────────────────────────

/** Shared portal dropdown — renders into document.body so table overflow never clips it. */
function ActionMenu({
  open,
  anchorRef,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div
        style={{
          position: "fixed",
          top: coords.top,
          right: coords.right,
          zIndex: 9999,
          minWidth: 200,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
          padding: "4px 0",
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

function MemberActions({
  member,
  onDone,
}: {
  member: TeamMember;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (member.isSelf) {
    return <span style={{ fontSize: 12, color: "var(--ink3)" }}>You</span>;
  }

  function act(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMsg(null);
    setOpen(false);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMsg(res.message ?? "Action failed.");
      else onDone();
    });
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {msg && (
        <span style={{ fontSize: 12, color: "#9A3B2E", whiteSpace: "nowrap" }}>{msg}</span>
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: open ? "var(--surface)" : "var(--card)",
          cursor: pending ? "wait" : "pointer",
          color: "var(--ink2)",
        }}
        aria-label="Actions"
      >
        <MoreHorizontal style={{ width: 15, height: 15 }} />
      </button>
      <ActionMenu open={open} anchorRef={btnRef} onClose={() => setOpen(false)}>
        {member.status === "active" ? (
          <>
            <MenuItem
              icon={<Ban style={{ width: 14, height: 14 }} />}
              label="Disable account"
              danger
              onClick={() => act(() => disableAdmin(member.id))}
            />
            {member.role === "ADMIN" ? (
              <MenuItem
                icon={<Crown style={{ width: 14, height: 14 }} />}
                label="Promote to Owner"
                onClick={() => act(() => changeAdminRole(member.id, "OWNER"))}
              />
            ) : (
              <MenuItem
                icon={<Shield style={{ width: 14, height: 14 }} />}
                label="Change to Admin"
                onClick={() => act(() => changeAdminRole(member.id, "ADMIN"))}
              />
            )}
          </>
        ) : (
          <MenuItem
            icon={<CheckCircle2 style={{ width: 14, height: 14 }} />}
            label="Enable account"
            onClick={() => act(() => enableAdmin(member.id))}
          />
        )}
        <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
        <MenuItem
          icon={<Trash2 style={{ width: 14, height: 14 }} />}
          label="Remove administrator"
          danger
          onClick={() => {
            if (!confirm(`Remove ${member.name} from the team? This cannot be undone.`)) return;
            act(() => removeAdmin(member.id));
          }}
        />
      </ActionMenu>
    </div>
  );
}

function InviteActions({ invite, onDone }: { invite: PendingInvite; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  function act(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setOpen(false);
    startTransition(async () => {
      await fn();
      onDone();
    });
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: open ? "var(--surface)" : "var(--card)",
          cursor: pending ? "wait" : "pointer",
          color: "var(--ink2)",
        }}
        aria-label="Actions"
      >
        <MoreHorizontal style={{ width: 15, height: 15 }} />
      </button>
      <ActionMenu open={open} anchorRef={btnRef} onClose={() => setOpen(false)}>
        <MenuItem
          icon={<RefreshCw style={{ width: 14, height: 14 }} />}
          label="Resend invitation"
          onClick={() => act(() => resendInvite(invite.id))}
        />
        <MenuItem
          icon={<Ban style={{ width: 14, height: 14 }} />}
          label="Revoke invitation"
          danger
          onClick={() => act(() => revokeInvite(invite.id))}
        />
      </ActionMenu>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "8px 14px",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        color: danger ? "#9A3B2E" : "var(--ink)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Main client component ─────────────────────────────────────────────────────

export function TeamPageClient({
  members,
  pendingInvites,
}: {
  members: TeamMember[];
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="admin-fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <h1
            className="font-fraunces"
            style={{ fontWeight: 600, fontSize: 34, letterSpacing: "-.01em", margin: "0 0 4px", color: "var(--ink)" }}
          >
            Team
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink2)" }}>
            Manage administrators and invitations.
          </p>
        </div>
        <Button variant="accent" onClick={() => setInviteOpen(true)} style={{ gap: 6 }}>
          <UserPlus style={{ width: 15, height: 15 }} />
          Invite administrator
        </Button>
      </div>

      {/* Active admins table */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
            Administrators
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: "var(--ink2)" }}>
              {members.length}
            </span>
          </p>
        </div>
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Invited</th>
                <th style={thStyle}>Last login</th>
                <th style={{ ...thStyle, textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={tdStyle}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{m.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink2)" }}>{m.email}</p>
                  </td>
                  <td style={tdStyle}><RoleBadge role={m.role} /></td>
                  <td style={tdStyle}><StatusBadge status={m.status} /></td>
                  <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>
                    {formatDate(m.invitedAt)}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>
                    {m.lastLoginAt ? formatDate(m.lastLoginAt) : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <MemberActions member={m} onDone={refresh} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div style={cardStyle}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              Pending invitations
              <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: "var(--ink2)" }}>
                {pendingInvites.length}
              </span>
            </p>
          </div>
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Invited</th>
                  <th style={thStyle}>Expires</th>
                  <th style={{ ...thStyle, textAlign: "right" }} />
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => {
                  const expired = inv.expiresAt < new Date();
                  return (
                    <tr key={inv.id}>
                      <td style={tdStyle}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{inv.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink2)" }}>{inv.email}</p>
                      </td>
                      <td style={tdStyle}><RoleBadge role={inv.role} /></td>
                      <td style={tdStyle}><StatusBadge status={expired ? "expired" : "pending"} /></td>
                      <td style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13 }}>{formatDate(inv.invitedAt)}</td>
                      <td style={{ ...tdStyle, color: expired ? "#9A3B2E" : "var(--ink2)", fontSize: 13 }}>
                        {formatDate(inv.expiresAt)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <InviteActions invite={inv} onDone={refresh} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InviteAdminModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => {
          setInviteOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
