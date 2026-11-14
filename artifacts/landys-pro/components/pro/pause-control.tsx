"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLeadsPause } from "@/app/actions/contractor-preferences";

/** Vacation / full-schedule switch for new job requests. */
export function PauseControl({ pausedUntil }: { pausedUntil: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState("14");

  function apply(value: number | null) {
    setMessage(null);
    startTransition(async () => {
      const res = await setLeadsPause(value);
      setMessage({ ok: res.ok, text: res.message });
      if (res.ok) router.refresh();
    });
  }

  const until = pausedUntil ? new Date(pausedUntil) : null;
  const paused = until && until.getTime() > Date.now();

  return (
    <div>
      {paused ? (
        <>
          <p style={{ margin: "0 0 14px" }}>
            Paused until <strong>{until!.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong>.
            You will not get new requests until then.
          </p>
          <button type="button" className="pro-btn pro-btn--forest" onClick={() => apply(null)} disabled={pending}>
            {pending ? "Saving..." : "Start getting requests again"}
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 14px" }}>
            Going on vacation or fully booked? Pause new requests. Jobs you already accepted are not affected.
          </p>
          <label className="pro-label" htmlFor="pause-days">
            Pause for
          </label>
          <select
            id="pause-days"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            style={{
              width: "100%",
              minHeight: 58,
              borderRadius: 14,
              border: "2px solid var(--pro-line-strong)",
              padding: "0 14px",
              fontSize: 18,
              background: "#fff",
              marginBottom: 12,
            }}
          >
            <option value="7">1 week</option>
            <option value="14">2 weeks</option>
            <option value="30">1 month</option>
            <option value="60">2 months</option>
          </select>
          <button type="button" className="pro-btn pro-btn--secondary" onClick={() => apply(Number(days))} disabled={pending}>
            {pending ? "Saving..." : "Pause new requests"}
          </button>
        </>
      )}
      {message && (
        <div className={`pro-notice ${message.ok ? "pro-notice--ok" : "pro-notice--danger"}`} style={{ marginTop: 14 }} role="status">
          {message.text}
        </div>
      )}
    </div>
  );
}
