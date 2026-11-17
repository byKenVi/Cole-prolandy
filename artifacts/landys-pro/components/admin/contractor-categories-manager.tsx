"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createContractorCategory,
  mergeContractorCategoryAction,
  setContractorCategoryArchived,
  updateContractorCategory,
} from "@/app/actions/admin";

type CategoryRow = {
  id: string;
  name: string;
  code: string;
  archived: boolean;
  contractors: number;
  leads: number;
};

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--fieldLine)",
  background: "var(--field)",
  padding: "0 12px",
  font: "500 14px/1 var(--ui)",
  color: "var(--ink)",
};

const buttonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid var(--fieldLine)",
  background: "var(--field)",
  padding: "0 12px",
  font: "600 13px/1 var(--ui)",
  color: "var(--ink)",
  cursor: "pointer",
};

export function ContractorCategoriesManager({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});

  function run(action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-[10px] bg-[var(--dangerBg)] p-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-[12px] border border-[var(--line)]">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--line2)] px-4 py-3 last:border-b-0"
          >
            {editingId === category.id ? (
              <>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  style={{ ...inputStyle, minWidth: 180, flex: 1 }}
                  autoFocus
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => updateContractorCategory(category.id, editName),
                      () => setEditingId(null),
                    )
                  }
                  style={buttonStyle}
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)} style={buttonStyle}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[14px] font-semibold text-[var(--ink)]">
                    {category.name}
                    {category.archived ? " (archived)" : ""}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--ink3)]">
                    {category.contractors} contractors, {category.leads} requests
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(category.id);
                    setEditName(category.name);
                  }}
                  style={buttonStyle}
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => setContractorCategoryArchived(category.id, !category.archived))
                  }
                  style={buttonStyle}
                >
                  {category.archived ? "Activate" : "Archive"}
                </button>
                {!category.archived && (
                  <span className="flex items-center gap-2">
                    <select
                      aria-label={`Merge ${category.name} into`}
                      value={mergeTarget[category.id] ?? ""}
                      onChange={(event) => setMergeTarget((m) => ({ ...m, [category.id]: event.target.value }))}
                      style={{ ...inputStyle, height: 44 }}
                    >
                      <option value="">Merge into...</option>
                      {categories
                        .filter((c) => c.id !== category.id && !c.archived)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending || !mergeTarget[category.id]}
                      onClick={() => {
                        const target = categories.find((c) => c.id === mergeTarget[category.id]);
                        if (
                          target &&
                          window.confirm(
                            `Merge "${category.name}" into "${target.name}"? Its contractors and requests move to "${target.name}", and future requests labelled "${category.name}" go there too.`,
                          )
                        ) {
                          run(() => mergeContractorCategoryAction(category.id, target.id));
                        }
                      }}
                      style={buttonStyle}
                    >
                      Merge
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New contractor category"
          style={{ ...inputStyle, minWidth: 180, flex: 1 }}
        />
        <button
          type="button"
          disabled={pending || newName.trim().length < 2}
          onClick={() => run(() => createContractorCategory(newName), () => setNewName(""))}
          style={{ ...buttonStyle, border: "none", background: "var(--gold)", color: "#fff" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
