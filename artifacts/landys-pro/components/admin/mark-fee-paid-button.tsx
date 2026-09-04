"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markFeePaidManually } from "@/app/actions/fees";

export function MarkFeePaidButton({
  leadMatchId,
  prominent = false,
}: {
  leadMatchId: string;
  prominent?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"check" | "offline">("check");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setPaidAt(new Date().toISOString().slice(0, 10));
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      const res = await markFeePaidManually(leadMatchId, note.trim() || undefined, {
        method,
        paidAt,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message ?? "Could not record payment.");
      }
    });
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, position: "relative", zIndex: 10 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="a-gold"
        title="Record a check or other offline payment to Landy's"
        style={{
          height: prominent ? 42 : 36,
          padding: prominent ? "0 16px" : "0 14px",
          background: "var(--gold)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          font: prominent ? "600 13px/1.2 'Inter'" : "600 13px/1 'Inter'",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {prominent ? "Record offline payment" : "Mark as paid"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md rounded-[18px] border p-6"
            style={{ background: "var(--card)", borderColor: "var(--line)" }}
          >
            <p style={{ margin: 0, font: "600 20px/1.2 var(--display)", color: "var(--ink)" }}>
              Record offline payment
            </p>
            <p style={{ margin: "8px 0 18px", font: "400 14px/1.45 'Inter'", color: "var(--ink2)" }}>
              Use this when the contractor paid Landy&apos;s by check or another offline method.
            </p>
            <label style={{ display: "block", font: "600 12px/1 'Inter'", color: "var(--ink3)", marginBottom: 6 }}>
              Payment date
            </label>
            <input
              type="date"
              required
              disabled={!paidAt}
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                marginBottom: 14,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid var(--fieldLine)",
                background: "var(--field)",
                color: "var(--ink)",
              }}
            />
            <label style={{ display: "block", font: "600 12px/1 'Inter'", color: "var(--ink3)", marginBottom: 6 }}>
              Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "check" | "offline")}
              style={{
                width: "100%",
                height: 44,
                marginBottom: 14,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid var(--fieldLine)",
                background: "var(--field)",
                color: "var(--ink)",
              }}
            >
              <option value="check">Check</option>
              <option value="offline">Other offline</option>
            </select>
            <label style={{ display: "block", font: "600 12px/1 'Inter'", color: "var(--ink3)", marginBottom: 6 }}>
              Reference / note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Check #1042"
              style={{
                width: "100%",
                height: 44,
                marginBottom: 14,
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid var(--fieldLine)",
                background: "var(--field)",
                color: "var(--ink)",
              }}
            />
            {error && (
              <p style={{ margin: "0 0 12px", font: "500 13px/1.3 'Inter'", color: "var(--danger)" }}>{error}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  height: 42,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--ink2)",
                  font: "600 13px/1 'Inter'",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="a-gold"
                style={{
                  height: 42,
                  padding: "0 16px",
                  border: "none",
                  borderRadius: 10,
                  background: "var(--gold)",
                  color: "#fff",
                  font: "600 13px/1 'Inter'",
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? "Saving…" : "Confirm paid"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
