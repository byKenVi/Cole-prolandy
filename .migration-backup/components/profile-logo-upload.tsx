"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { clearContractorLogo, uploadContractorLogo } from "@/app/actions/profile-logo";

export function ProfileLogoUpload({
  logoUrl,
  initials,
}: {
  logoUrl?: string | null;
  initials: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = preview || logoUrl || null;

  function onPick(file: File | null) {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("logo", file);
    startTransition(async () => {
      const res = await uploadContractorLogo(fd);
      if (!res.ok) {
        setError(res.message);
        setPreview(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#3B372F] text-3xl font-semibold text-[#F6EEDF] ring-2 ring-[#EBE3D4] transition hover:ring-[#C0803C]"
        aria-label="Upload profile logo"
        title="Upload logo"
      >
        {shown ? (
          <Image src={shown.split("?")[0]} alt="" fill className="object-cover" unoptimized />
        ) : (
          initials
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="rounded-[10px] border border-[#E6DFD1] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#5A4E3E] hover:bg-[#F7F0E3] disabled:opacity-60"
        >
          {pending ? "Uploading…" : shown ? "Change logo" : "Upload logo"}
        </button>
        {logoUrl && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setPreview(null);
                await clearContractorLogo();
              })
            }
            className="rounded-[10px] border border-transparent px-3 py-1.5 text-[13px] font-medium text-[#8A7E68] hover:text-[#5A4E3E]"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
