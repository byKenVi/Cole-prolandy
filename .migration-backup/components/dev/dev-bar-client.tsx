"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDevRole, setDevContractor, exitViewAs } from "@/app/actions/dev";
import { Select } from "@/components/ui/select";
import type { Role } from "@/lib/auth";

export function DevBarClient({
  role,
  contractorId,
  viewingAs,
  contractors,
}: {
  role: Role;
  contractorId: string | null;
  viewingAs: boolean;
  contractors: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2 bg-primary px-3 py-2 text-xs text-white">
      <span className="font-semibold uppercase tracking-wide opacity-80">Dev</span>

      <Select
        aria-label="Role"
        className="h-8 w-auto border-white/20 bg-primary-hover text-white"
        value={role}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Role;
          startTransition(async () => {
            await setDevRole(next);
            router.push(next === "admin" ? "/admin" : "/home");
          });
        }}
      >
        <option value="contractor">Contractor</option>
        <option value="admin">Admin</option>
      </Select>

      {role === "contractor" && (
        <Select
          aria-label="Active contractor"
          className="h-8 w-auto border-white/20 bg-primary-hover text-white"
          value={contractorId ?? ""}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () => {
              await setDevContractor(e.target.value);
              router.refresh();
            })
          }
        >
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}

      {viewingAs && (
        <button
          className="ml-auto rounded-full bg-accent px-3 py-1 font-medium"
          disabled={pending}
          onClick={() => startTransition(() => exitViewAs())}
        >
          Exit “view as”
        </button>
      )}
    </div>
  );
}
