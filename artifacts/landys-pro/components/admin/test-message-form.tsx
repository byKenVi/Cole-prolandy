"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendTestMessageAction } from "@/app/actions/admin-ops";

const input: React.CSSProperties = {
  height: 44,
  padding: "0 12px",
  border: "1px solid var(--fieldLine)",
  borderRadius: 10,
  background: "var(--field)",
  color: "var(--ink)",
  fontSize: 15,
  minWidth: 220,
};

/** Send one test email and/or text to check that Resend and Twilio deliver. */
export function TestMessageForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function send(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await sendTestMessageAction({ email, phone });
      setResult(res);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={send}
      style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", padding: 16, border: "1px solid var(--line)", borderRadius: 14, background: "var(--card)", marginBottom: 16 }}
    >
      <div style={{ flexBasis: "100%", font: "600 15px/1.3 Rubik, sans-serif", color: "var(--ink)" }}>Send a test message</div>
      <label style={{ display: "grid", gap: 4, font: "500 12px/1.2 Rubik, sans-serif", color: "var(--ink2)" }}>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={input} />
      </label>
      <label style={{ display: "grid", gap: 4, font: "500 12px/1.2 Rubik, sans-serif", color: "var(--ink2)" }}>
        Mobile
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(512) 555-0100" style={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{ height: 44, padding: "0 18px", borderRadius: 10, border: 0, background: "var(--gold)", color: "#fff", font: "600 14px/1 Rubik, sans-serif" }}
      >
        {pending ? "Sending..." : "Send test"}
      </button>
      {result && (
        <p role="status" style={{ flexBasis: "100%", margin: 0, font: "500 14px/1.45 Rubik, sans-serif", color: result.ok ? "var(--pos)" : "var(--danger)" }}>
          {result.message}
        </p>
      )}
    </form>
  );
}
