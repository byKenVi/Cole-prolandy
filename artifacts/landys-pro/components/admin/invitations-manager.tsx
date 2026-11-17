"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelInvitationsAction, scheduleInvitationsAction } from "@/app/actions/admin";

export type InvitationRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  hasAccount: boolean;
  lastInvitedAt: string | null;
  inviteCount: number;
  inviteScheduledFor: string | null;
  inviteLastError: string | null;
  fromLandys: boolean;
  hasServiceArea: boolean;
};

const cell: React.CSSProperties = { padding: "12px 14px", font: "400 14px/1.4 var(--ui)", verticalAlign: "top" };
const head: React.CSSProperties = { ...cell, font: "500 13px/1.3 var(--ui)", color: "var(--ink2)", textAlign: "left" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function InvitationsManager({ rows }: { rows: InvitationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [when, setWhen] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selectable = useMemo(() => rows.filter((r) => !r.hasAccount), [rows]);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));
  }

  function send(schedule: boolean) {
    setMessage(null);
    const ids = [...selected];
    if (ids.length === 0) {
      setMessage({ ok: false, text: "Select at least one contractor." });
      return;
    }
    let sendAt: string | null = null;
    if (schedule) {
      if (!when) {
        setMessage({ ok: false, text: "Choose the date and time to send." });
        return;
      }
      const date = new Date(when);
      if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 60_000) {
        setMessage({ ok: false, text: "Choose a date and time in the future." });
        return;
      }
      sendAt = date.toISOString();
    }
    const confirmText = schedule
      ? `Schedule the account invitation (email + text) for ${ids.length} contractor(s) on ${new Date(when).toLocaleString()}?`
      : `Send the account invitation (email + text) to ${ids.length} contractor(s) now?`;
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      const res = await scheduleInvitationsAction({ contractorIds: ids, sendAt });
      setMessage({ ok: res.ok, text: res.message ?? (res.ok ? "Done." : "Failed.") });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function cancel() {
    const ids = [...selected];
    if (ids.length === 0) {
      setMessage({ ok: false, text: "Select the scheduled invitations to cancel." });
      return;
    }
    startTransition(async () => {
      const res = await cancelInvitationsAction(ids);
      setMessage({ ok: res.ok, text: res.message ?? "" });
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 12,
          padding: 16,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ font: "600 14px/1.3 var(--ui)", color: "var(--ink)", marginRight: "auto" }}>
          {selected.size} selected
        </div>
        <button
          type="button"
          onClick={() => send(false)}
          disabled={pending || selected.size === 0}
          style={{
            height: 44,
            padding: "0 18px",
            borderRadius: 10,
            border: 0,
            background: "var(--gold)",
            color: "#fff",
            font: "600 14px/1 var(--ui)",
            opacity: pending || selected.size === 0 ? 0.6 : 1,
          }}
        >
          Send now
        </button>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, font: "500 12px/1.2 var(--ui)", color: "var(--ink2)" }}>
          Or send on
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            style={{ height: 44, borderRadius: 10, border: "1px solid var(--fieldLine)", padding: "0 10px", background: "var(--field)", color: "var(--ink)" }}
          />
        </label>
        <button
          type="button"
          onClick={() => send(true)}
          disabled={pending || selected.size === 0}
          style={{
            height: 44,
            padding: "0 18px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--card)",
            color: "var(--ink)",
            font: "600 14px/1 var(--ui)",
            opacity: pending || selected.size === 0 ? 0.6 : 1,
          }}
        >
          Schedule
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending || selected.size === 0}
          style={{
            height: 44,
            padding: "0 14px",
            borderRadius: 10,
            border: 0,
            background: "transparent",
            color: "var(--ink2)",
            textDecoration: "underline",
            font: "500 14px/1 var(--ui)",
          }}
        >
          Cancel schedule
        </button>
      </div>

      {message && (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "12px 16px",
            font: "500 14px/1.4 var(--ui)",
            color: message.ok ? "var(--pos)" : "var(--danger)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {message.text}
        </p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th style={{ ...head, width: 44 }}>
                <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} />
              </th>
              <th style={head}>Contractor</th>
              <th style={head}>Contact</th>
              <th style={head}>Invitation</th>
              <th style={head}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={cell}>
                  {!row.hasAccount && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  )}
                </td>
                <td style={cell}>
                  <a href={`/admin/contractors/${row.id}`} style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {row.name}
                  </a>
                  {row.fromLandys && <div style={{ color: "var(--ink3)", fontSize: 12 }}>From landys.co</div>}
                </td>
                <td style={cell}>
                  <div>{row.email}</div>
                  <div style={{ color: "var(--ink2)" }}>{row.phone || "No mobile number"}</div>
                </td>
                <td style={cell}>
                  {row.hasAccount ? (
                    <span style={{ color: "var(--pos)", fontWeight: 600 }}>Account created</span>
                  ) : row.inviteScheduledFor ? (
                    <span style={{ color: "var(--goldStrong)", fontWeight: 600 }}>Scheduled for {fmt(row.inviteScheduledFor)}</span>
                  ) : row.lastInvitedAt ? (
                    <span>
                      Sent {fmt(row.lastInvitedAt)}
                      {row.inviteCount > 1 ? ` (${row.inviteCount} times)` : ""}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink2)" }}>Never invited</span>
                  )}
                </td>
                <td style={{ ...cell, color: "var(--ink2)" }}>
                  {row.inviteLastError && <div style={{ color: "var(--danger)" }}>{row.inviteLastError}</div>}
                  {!row.hasServiceArea && <div>No service area: will not receive nearby leads</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
