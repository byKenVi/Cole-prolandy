"use client";

import { useState, useTransition } from "react";
import { updateSetting } from "@/app/actions/admin";

export type NumberSettingField = {
  key: "serviceRadiusMiles" | "landownerHireCheckDelayDays" | "followUpMaxAttempts";
  label: string;
  help: string;
  unit: string;
  value: number;
  min: number;
  max: number;
};

/** Small form for whole-number settings saved through updateSetting. */
export function NumberSettingsForm({ fields, submitLabel }: { fields: NumberSettingField[]; submitLabel: string }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(f.value)])),
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      for (const field of fields) {
        const n = Number(values[field.key]);
        if (!Number.isInteger(n) || n < field.min || n > field.max) {
          setMessage({ ok: false, text: `${field.label}: enter a whole number between ${field.min} and ${field.max}.` });
          return;
        }
        const res = await updateSetting(field.key, n);
        if (!res.ok) {
          setMessage({ ok: false, text: res.message });
          return;
        }
      }
      setMessage({ ok: true, text: "Saved" });
    });
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 16, marginTop: 18 }}>
      {fields.map((field) => (
        <label key={field.key} style={{ display: "grid", gap: 6 }}>
          <span style={{ font: "600 14px/1.3 var(--label)", color: "var(--ink)" }}>{field.label}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              inputMode="numeric"
              min={field.min}
              max={field.max}
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              style={{
                width: 140,
                height: 46,
                padding: "0 12px",
                border: "1px solid var(--fieldLine)",
                borderRadius: 11,
                background: "var(--field)",
                color: "var(--ink)",
                fontSize: 15,
              }}
            />
            <span style={{ color: "var(--ink2)", fontSize: 14 }}>{field.unit}</span>
          </span>
          <span style={{ color: "var(--ink2)", fontSize: 13, lineHeight: 1.45 }}>{field.help}</span>
        </label>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={pending}
          style={{ height: 44, padding: "0 18px", borderRadius: 10, border: 0, background: "var(--gold)", color: "#fff", font: "600 14px/1 var(--label)" }}
        >
          {pending ? "Saving..." : submitLabel}
        </button>
        {message && (
          <span role="status" style={{ font: "500 14px/1.3 var(--label)", color: message.ok ? "var(--pos)" : "var(--danger)" }}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
