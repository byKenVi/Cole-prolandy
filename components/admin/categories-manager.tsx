"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  createContractorType,
  updateContractorType,
  deleteContractorType,
} from "@/app/actions/admin";
import {
  ICON_KEYS,
  ICON_LABELS,
  ICON_AUTO,
  ICON_NONE,
  iconSrcForKey,
  type IconKey,
} from "@/lib/project-icons";
import { TrashIcon } from "@/components/admin/trash-icon";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  contractors: number;
  leads: number;
};

const LIST_PAGE_SIZE = 8;

function normalizeIcon(icon: string | null): string {
  return icon || ICON_AUTO;
}

/** Selectable grid of icon options (Auto, None + the 12 icons). */
function IconPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const tile = (key: string, selected: boolean, content: React.ReactNode, label: string) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={() => onChange(key)}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      style={{
        display: "flex",
        height: 48,
        width: 48,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        border: `1px solid ${selected ? "var(--gold)" : "var(--fieldLine)"}`,
        outline: selected ? "2px solid color-mix(in srgb,var(--gold) 40%,transparent)" : "none",
        background: selected ? "var(--goldSoft)" : "var(--field)",
        cursor: disabled ? "default" : "pointer",
        font: "500 10px/1 'Inter'",
        color: "var(--ink3)",
      }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {tile(ICON_AUTO, value === ICON_AUTO, <span>Auto</span>, "Auto (match by name)")}
      {tile(ICON_NONE, value === ICON_NONE, <span>None</span>, "None")}
      {ICON_KEYS.map((key) =>
        tile(
          key,
          value === key,
          <Image
            src={iconSrcForKey(key as IconKey)}
            alt=""
            aria-hidden
            width={40}
            height={40}
            style={{ height: 32, width: 32, objectFit: "contain" }}
          />,
          ICON_LABELS[key as IconKey],
        ),
      )}
    </div>
  );
}

function IconPreview({ icon }: { icon: string }) {
  if ((ICON_KEYS as readonly string[]).includes(icon)) {
    return (
      <Image
        src={iconSrcForKey(icon as IconKey)}
        alt=""
        aria-hidden
        width={32}
        height={32}
        style={{ height: 26, width: 26, objectFit: "contain" }}
      />
    );
  }
  return <span style={{ font: "400 11px/1 'Inter'", color: "var(--ink3)" }}>{icon === ICON_NONE ? "None" : "Auto"}</span>;
}

const smallBtn: React.CSSProperties = {
  height: 34,
  padding: "0 13px",
  background: "var(--field)",
  border: "1px solid var(--fieldLine)",
  borderRadius: 9,
  font: "600 12px/1 'Inter'",
  color: "var(--ink)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  border: "1px solid var(--fieldLine)",
  borderRadius: 10,
  background: "var(--field)",
  color: "var(--ink)",
  font: "500 14px/1 'Inter'",
};

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<string>(ICON_AUTO);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<string>(ICON_AUTO);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, deferredQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * LIST_PAGE_SIZE, safePage * LIST_PAGE_SIZE);

  function onQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 16,
          background: "var(--card2)",
        }}
      >
        <p style={{ margin: 0, font: "600 13px/1 'Inter'", color: "var(--ink)" }}>Add project</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name (e.g. Culvert Install)"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button
            type="button"
            className="a-gold"
            disabled={pending || newName.trim().length < 2}
            onClick={() =>
              run(
                () => createContractorType(newName, newIcon),
                () => {
                  setNewName("");
                  setNewIcon(ICON_AUTO);
                },
              )
            }
            style={{
              height: 40,
              padding: "0 18px",
              background: "var(--gold)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              font: "600 13px/1 'Inter'",
              cursor: "pointer",
              opacity: pending || newName.trim().length < 2 ? 0.6 : 1,
            }}
          >
            Add project
          </button>
        </div>
        <div>
          <p style={{ margin: "0 0 6px", font: "600 12px/1 'Inter'", color: "var(--ink3)" }}>Icon</p>
          <IconPicker value={newIcon} onChange={setNewIcon} disabled={pending} />
        </div>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 42,
          padding: "0 12px",
          background: "var(--field)",
          border: "1px solid var(--fieldLine)",
          borderRadius: 10,
        }}
      >
        <Search size={15} aria-hidden style={{ color: "var(--ink3)", flex: "none" }} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search projects…"
          aria-label="Search projects"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            font: "500 14px/1 'Inter'",
            color: "var(--ink)",
          }}
        />
      </label>

      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {pageItems.map((c) => (
          <div
            key={c.id}
            style={{ padding: "13px 16px", borderBottom: "1px solid var(--line2)" }}
            className={editingId === c.id ? undefined : "a-row"}
          >
            {editingId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                    onClick={() => run(() => updateContractorType(c.id, editName, editIcon), () => setEditingId(null))}
                    style={{ ...smallBtn, background: "var(--sageFg)", color: "#fff", border: "none" }}
                  >
                    Save
                  </button>
                  <button type="button" disabled={pending} onClick={() => setEditingId(null)} style={smallBtn}>
                    Cancel
                  </button>
                </div>
                <div>
                  <p style={{ margin: "0 0 6px", font: "600 12px/1 'Inter'", color: "var(--ink3)" }}>
                    Icon
                  </p>
                  <IconPicker value={editIcon} onChange={setEditIcon} disabled={pending} />
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      flex: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "var(--card2)",
                    }}
                  >
                    <IconPreview icon={normalizeIcon(c.icon)} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: "600 14px/1.2 'Inter'", color: "var(--ink)" }}>
                      {c.name}
                    </p>
                    <p style={{ margin: "3px 0 0", font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
                      {c.contractors} contractor{c.contractors === 1 ? "" : "s"}
                      {typeof c.leads === "number" ? ` · ${c.leads} lead${c.leads === 1 ? "" : "s"}` : ""}
                      {" · 3 tiers"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flex: "none" }}>
                  <button
                    type="button"
                    className="a-ghostbtn"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditName(c.name);
                      setEditIcon(normalizeIcon(c.icon));
                      setError(null);
                    }}
                    style={smallBtn}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${c.name}`}
                    className="a-dangerbtn"
                    disabled={pending}
                    onClick={() => run(() => deleteContractorType(c.id))}
                    style={{
                      width: 34,
                      height: 34,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--field)",
                      border: "1px solid var(--dangerLine)",
                      borderRadius: 9,
                      color: "var(--danger)",
                      cursor: "pointer",
                    }}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {pageItems.length === 0 && (
          <p style={{ padding: "13px 16px", font: "400 13px/1 'Inter'", color: "var(--ink3)" }}>
            {query.trim() ? `No projects match “${query.trim()}”.` : "No projects yet."}
          </p>
        )}

        {filtered.length > LIST_PAGE_SIZE && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 14px",
              background: "var(--card2)",
            }}
          >
            <p style={{ margin: 0, font: "400 12px/1 'Inter'", color: "var(--ink3)" }}>
              Page {safePage} of {totalPages} · {filtered.length} total
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                style={{
                  ...smallBtn,
                  opacity: safePage <= 1 ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <ChevronLeft size={14} aria-hidden /> Prev
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                style={{
                  ...smallBtn,
                  opacity: safePage >= totalPages ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                Next <ChevronRight size={14} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
