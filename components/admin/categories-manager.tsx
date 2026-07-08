"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createContractorType,
  updateContractorType,
  deleteContractorType,
} from "@/app/actions/admin";

type Category = {
  id: string;
  name: string;
  contractors: number;
  projectTypes: number;
};

export function CategoriesManager({ categories }: { categories: Category[] }) {
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
    <div className="flex flex-col gap-5">
      {error && (
        <p className="rounded-sm bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>
      )}

      <ul className="divide-y divide-border rounded-md border border-border">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            {editingId === c.id ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="max-w-xs"
                  autoFocus
                />
                <Button
                  variant="brand"
                  size="sm"
                  loading={pending}
                  disabled={pending}
                  onClick={() =>
                    run(() => updateContractorType(c.id, editName), () => setEditingId(null))
                  }
                >
                  <Check className="h-4 w-4" /> Save
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-medium text-text">{c.name}</p>
                  <p className="text-xs text-text-muted">
                    {c.contractors} contractor(s) · {c.projectTypes} project type(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditName(c.name);
                      setError(null);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Rename
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => deleteContractorType(c.id))}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
        {categories.length === 0 && (
          <li className="px-4 py-3 text-sm text-text-muted">No categories yet.</li>
        )}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name (e.g. Fencing)"
          />
        </div>
        <Button
          variant="accent"
          loading={pending}
          disabled={pending || newName.trim().length < 2}
          onClick={() => run(() => createContractorType(newName), () => setNewName(""))}
        >
          Add category
        </Button>
      </div>
    </div>
  );
}
