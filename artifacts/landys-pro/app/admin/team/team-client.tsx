"use client";

import { useState, useTransition, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { UserPlus, MoreHorizontal, RefreshCw, Ban, CheckCircle2, Trash2, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
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

// ─── Server action results ─────────────────────────────────────────────────────

type ActionResult = {
  ok: boolean;
  message?: string;
  severity?: "success" | "warning";
};

/** Report an outcome, keeping a partial success (e.g. saved but email failed)
 *  visually distinct from a clean one. */
function report(
  toast: { success: (m: string) => void; warning: (m: string) => void; error: (m: string) => void },
  res: ActionResult,
  fallback: string,
) {
  if (!res.ok) {
    toast.error(res.message ?? "Action failed.");
    return;
  }
  const message = res.message ?? fallback;
  if (res.severity === "warning") toast.warning(message);
  else toast.success(message);
}

// ─── Portal dropdown coords ────────────────────────────────────────────────────

type MenuCoords = {
  /** Preferred position: just below the trigger. */
  top: number;
  /** Fallback anchor when the menu would overflow the viewport: just above it. */
  above: number;
  right: number;
};

function getMenuCoords(btn: HTMLButtonElement): MenuCoords {
  const r = btn.getBoundingClientRect();
  return { top: r.bottom + 6, above: r.top - 6, right: window.innerWidth - r.right };
}

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
  whiteSpace: "nowrap",
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
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "OWNER" | "ADMIN" }) {
  return role === "OWNER" ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#C0803C", whiteSpace: "nowrap" }}>
      <Crown style={{ width: 13, height: 13 }} /> Owner
    </span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink2)", whiteSpace: "nowrap" }}>
      <Shield style={{ width: 13, height: 13 }} /> Admin
    </span>
  );
}

// ─── Row action menu ───────────────────────────────────────────────────────────

/** Shared portal dropdown — renders into document.body so table overflow never clips it.
 *  Coords are computed by the caller at click time so the menu never flashes at (0,0).
 *
 *  Once rendered it measures itself and flips above the trigger when it would
 *  run past the bottom of the viewport, which is what cut the last item off for
 *  rows near the end of a table. */
function ActionMenu({
  open,
  coords,
  onClose,
  children,
}: {
  open: boolean;
  coords: MenuCoords;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(coords.top);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const height = ref.current.offsetHeight;
    const fitsBelow = coords.top + height <= window.innerHeight - 8;
    setTop(fitsBelow ? coords.top : Math.max(8, coords.above - height));
  }, [open, coords]);

  // Escape closes; scrolling or resizing invalidates the measured position.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div
        ref={ref}
        role="menu"
        style={{
          position: "fixed",
          top,
          right: Math.max(coords.right, 8),
          zIndex: 9999,
          minWidth: 210,
          maxWidth: "calc(100vw - 16px)",
          maxHeight: "calc(100vh - 16px)",
          overflowY: "auto",
          /* Literal fallbacks: the portal target sits outside `.admin-theme`. */
          background: "var(--card, #ffffff)",
          border: "1px solid var(--line, #EBE3D4)",
          borderRadius: 12,
          boxShadow: "0 12px 34px rgba(58,53,45,0.20)",
          padding: "4px 0",
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

/** 44px square trigger — meets the minimum touch target on phones. */
const triggerStyle = (open: boolean, pending: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: open ? "var(--surface)" : "var(--card)",
  cursor: pending ? "wait" : "pointer",
  color: "var(--ink2)",
  flex: "none",
  opacity: pending ? 0.6 : 1,
});

function MemberActions({ member, onDone }: { member: TeamMember; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords>({ top: 0, above: 0, right: 0 });
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (member.isSelf) {
    return <span style={{ fontSize: 12, color: "var(--ink3)" }}>You</span>;
  }

  function act(fn: () => Promise<ActionResult>, successMessage: string) {
    setOpen(false);
    startTransition(async () => {
      const res = await fn();
      report(toast, res, successMessage);
      if (res.ok) onDone();
    });
  }

  function toggle() {
    if (!open && btnRef.current) setCoords(getMenuCoords(btnRef.current));
    setOpen((v) => !v);
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={pending}
        style={triggerStyle(open, pending)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${member.name}`}
      >
        <MoreHorizontal style={{ width: 17, height: 17 }} />
      </button>
      <ActionMenu open={open} coords={coords} onClose={() => setOpen(false)}>
        {member.status === "active" ? (
          <>
            <MenuItem
              icon={<Ban style={{ width: 14, height: 14 }} />}
              label="Disable account"
              danger
              onClick={() => act(() => disableAdmin(member.id), `${member.name} disabled.`)}
            />
            {member.role === "ADMIN" ? (
              <MenuItem
                icon={<Crown style={{ width: 14, height: 14 }} />}
                label="Promote to Owner"
                onClick={() =>
                  act(() => changeAdminRole(member.id, "OWNER"), `${member.name} is now an Owner.`)
                }
              />
            ) : (
              <MenuItem
                icon={<Shield style={{ width: 14, height: 14 }} />}
                label="Change to Admin"
                onClick={() =>
                  act(() => changeAdminRole(member.id, "ADMIN"), `${member.name} is now an Admin.`)
                }
              />
            )}
          </>
        ) : (
          <MenuItem
            icon={<CheckCircle2 style={{ width: 14, height: 14 }} />}
            label="Enable account"
            onClick={() => act(() => enableAdmin(member.id), `${member.name} enabled.`)}
          />
        )}
        <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
        <MenuItem
          icon={<Trash2 style={{ width: 14, height: 14 }} />}
          label="Remove administrator"
          danger
          onClick={() => {
            setOpen(false);
            setConfirmRemove(true);
          }}
        />
      </ActionMenu>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove this administrator?"
        description={`${member.name} (${member.email}) will lose access to the admin dashboard immediately. This cannot be undone.`}
        confirmLabel="Remove administrator"
        onConfirm={() => removeAdmin(member.id)}
        onSuccess={() => {
          toast.success(`${member.name} was removed from the team.`);
          onDone();
        }}
      />
    </div>
  );
}

function InviteActions({ invite, onDone }: { invite: PendingInvite; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords>({ top: 0, above: 0, right: 0 });
  const [pending, startTransition] = useTransition();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  function act(fn: () => Promise<ActionResult>, successMessage: string) {
    setOpen(false);
    startTransition(async () => {
      const res = await fn();
      report(toast, res, successMessage);
      if (res.ok) onDone();
    });
  }

  function toggle() {
    if (!open && btnRef.current) setCoords(getMenuCoords(btnRef.current));
    setOpen((v) => !v);
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={pending}
        style={triggerStyle(open, pending)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for the invitation to ${invite.email}`}
      >
        <MoreHorizontal style={{ width: 17, height: 17 }} />
      </button>
      <ActionMenu open={open} coords={coords} onClose={() => setOpen(false)}>
        <MenuItem
          icon={<RefreshCw style={{ width: 14, height: 14 }} />}
          label="Resend invitation"
          onClick={() => act(() => resendInvite(invite.id), "Invitation resent.")}
        />
        <MenuItem
          icon={<Ban style={{ width: 14, height: 14 }} />}
          label="Revoke invitation"
          danger
          onClick={() => {
            setOpen(false);
            setConfirmRevoke(true);
          }}
        />
      </ActionMenu>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Revoke this invitation?"
        description={`The link sent to ${invite.email} will stop working. You can invite them again later.`}
        confirmLabel="Revoke invitation"
        onConfirm={() => revokeInvite(invite.id)}
        onSuccess={() => {
          toast.success("Invitation revoked.");
          onDone();
        }}
      />
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
      role="menuitem"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        minHeight: 44,
        padding: "8px 14px",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: 13.5,
        whiteSpace: "nowrap",
        color: danger ? "#9A3B2E" : "var(--ink, #3A352D)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#F9EEEB" : "#FBF6EC";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "none";
      }}
    >
      <span style={{ flex: "none", display: "inline-flex" }}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Mobile card row (tables collapse to these below 1025px — see globals.css) ─

function MobileRow({
  name,
  email,
  role,
  status,
  meta,
  actions,
}: {
  name: string;
  email: string;
  role: "OWNER" | "ADMIN";
  status: "active" | "disabled" | "pending" | "expired";
  meta: string;
  actions: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--ink)", wordBreak: "break-word" }}>
          {name}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink2)", wordBreak: "break-all" }}>
          {email}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
          <RoleBadge role={role} />
          <StatusBadge status={status} />
        </div>
        <p suppressHydrationWarning style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink3)" }}>
          {meta}
        </p>
      </div>
      {actions}
    </div>
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
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="admin-fade-up">
      {/* Header — wraps so the CTA drops below the title on narrow screens */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            className="font-fraunces admin-page-title"
            style={{ fontWeight: 600, letterSpacing: "-.01em", margin: "0 0 4px", color: "var(--ink)" }}
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

      {/* Administrators */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
            Administrators
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: "var(--ink2)" }}>
              {members.length}
            </span>
          </p>
        </div>

        <div className="admin-table-desktop" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
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
                  <td suppressHydrationWarning style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13, whiteSpace: "nowrap" }}>
                    {formatDate(m.invitedAt)}
                  </td>
                  <td suppressHydrationWarning style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13, whiteSpace: "nowrap" }}>
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

        <div className="admin-table-mobile">
          {members.map((m) => (
            <MobileRow
              key={m.id}
              name={m.name}
              email={m.email}
              role={m.role}
              status={m.status}
              meta={`Invited ${formatDate(m.invitedAt)} · Last login ${m.lastLoginAt ? formatDate(m.lastLoginAt) : "—"}`}
              actions={<MemberActions member={m} onDone={refresh} />}
            />
          ))}
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

          <div className="admin-table-desktop" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
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
                      <td suppressHydrationWarning style={{ ...tdStyle, color: "var(--ink2)", fontSize: 13, whiteSpace: "nowrap" }}>
                        {formatDate(inv.invitedAt)}
                      </td>
                      <td suppressHydrationWarning style={{ ...tdStyle, color: expired ? "#9A3B2E" : "var(--ink2)", fontSize: 13, whiteSpace: "nowrap" }}>
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

          <div className="admin-table-mobile">
            {pendingInvites.map((inv) => {
              const expired = inv.expiresAt < new Date();
              return (
                <MobileRow
                  key={inv.id}
                  name={inv.name}
                  email={inv.email}
                  role={inv.role}
                  status={expired ? "expired" : "pending"}
                  meta={`Invited ${formatDate(inv.invitedAt)} · Expires ${formatDate(inv.expiresAt)}`}
                  actions={<InviteActions invite={inv} onDone={refresh} />}
                />
              );
            })}
          </div>
        </div>
      )}

      <InviteAdminModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={(message, severity) => {
          setInviteOpen(false);
          if (severity === "warning") toast.warning(message);
          else toast.success(message);
          refresh();
        }}
      />
    </div>
  );
}
