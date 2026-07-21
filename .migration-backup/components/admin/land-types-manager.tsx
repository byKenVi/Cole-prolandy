"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLandType, updateLandType, deleteLandType } from "@/app/actions/admin";
import { TrashIcon } from "@/components/admin/trash-icon";

type LandTypeRow = {
  id: string;
  name: string;
  leads: number;
};

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--fieldLine)",
  background: "var(--field)",
  padding: "0 12px",
  font: "500 14px/1 'Inter'",
  color: "var(--ink)",
};

const smallBtn: React.CSSProperties = {
  height: 36,
  borderRadius: 10,
  border: "1px solid var(--fieldLine)",
  background: "var(--field)",
  padding: "0 12px",
  font: "600 13px/1 'Inter'",
  color: "var(--ink)",
  cursor: "pointer",
};

export function LandTypesManager({ landTypes }: { landTypes: LandTypeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else {
        setError(res.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <p
          style={{
            margin: 0,
            borderRadius: 10,
            background: "var(--dangerBg)",
            padding: 12,
            font: "500 13px/1.4 'Inter'",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {landTypes.map((lt) => (
          <div
            key={lt.id}
            style={{ padding: "13px 16px", borderBottom: "1px solid var(--line2)" }}
            className={editingId === lt.id ? undefined : "a-row"}
          >
            {editingId === lt.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  style={{ ...inputStyle, flex: 1, minWidth: 180 }}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => updateLandType(lt.id, editName), () => setEditingId(null))}
                  style={{ ...smallBtn, background: "var(--sageFg)", color: "#fff", border: "none" }}
                >
                  Save
                </button>
                <button type="button" disabled={pending} onClick={() => setEditingId(null)} style={smallBtn}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, font: "600 14px/1.2 'Inter'", color: "var(--ink)" }}>{lt.name}</p>
                  <p style={{ margin: "4px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
                    {lt.leads} lead{lt.leads === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setEditingId(lt.id);
                    setEditName(lt.name);
                  }}
                  style={smallBtn}
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={pending || lt.leads > 0}
                  title={lt.leads > 0 ? "Remove leads first" : "Delete"}
                  onClick={() => {
                    if (confirm(`Delete land type "${lt.name}"?`)) {
                      run(() => deleteLandType(lt.id));
                    }
                  }}
                  style={{
                    ...smallBtn,
                    opacity: lt.leads > 0 ? 0.4 : 1,
                    color: "var(--danger)",
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </div>
        ))}
        {landTypes.length === 0 && (
          <p style={{ margin: 0, padding: 16, font: "400 13px/1.4 'Inter'", color: "var(--ink3)" }}>
            No land types yet.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New land type"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <button
          type="button"
          disabled={pending || newName.trim().length < 2}
          onClick={() =>
            run(() => createLandType(newName), () => setNewName(""))
          }
          style={{ ...smallBtn, background: "var(--gold)", color: "#fff", border: "none" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
