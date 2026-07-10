"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DAYS,
  type BusinessHoursValue,
  type DayKey,
  formatBusinessHours,
  parseBusinessHours,
  timeOptions,
} from "@/lib/business-hours";

const TIMES = timeOptions();

/**
 * Day toggles + open/close time selects. Emits a formatted string suitable for
 * Contractor.businessHours (e.g. "Mon–Fri 7:00 AM – 6:00 PM").
 */
export function BusinessHoursPicker({
  value,
  onChange,
  id = "business-hours",
}: {
  /** Stored string (or empty). */
  value: string;
  onChange: (formatted: string) => void;
  id?: string;
}) {
  const parsed = parseBusinessHours(value);

  function commit(next: BusinessHoursValue) {
    onChange(formatBusinessHours(next));
  }

  function toggleDay(key: DayKey) {
    const days = parsed.days.includes(key)
      ? parsed.days.filter((d) => d !== key)
      : [...parsed.days, key];
    commit({ ...parsed, days });
  }

  function setOpen(open: string) {
    let close = parsed.close;
    if (close <= open) {
      // Keep a sensible window if open moves past close.
      const idx = TIMES.findIndex((t) => t.value === open);
      close = TIMES[Math.min(idx + 2, TIMES.length - 1)]?.value ?? "18:00";
    }
    commit({ ...parsed, open, close });
  }

  function setClose(close: string) {
    commit({ ...parsed, close: close > parsed.open ? close : parsed.close });
  }

  const preview = formatBusinessHours(parsed);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Days open</Label>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Days of the week">
          {DAYS.map((d) => {
            const on = parsed.days.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d.key)}
                className={cn(
                  "min-w-[48px] rounded-[12px] border px-3 py-2.5 text-sm font-semibold transition-colors",
                  on
                    ? "border-[#C0803C] bg-[#C0803C] text-white"
                    : "border-border bg-surface text-text-muted hover:border-[#C0803C]/60 hover:text-text",
                )}
              >
                <span className="sm:hidden">{d.short}</span>
                <span className="hidden sm:inline">{d.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-open`}>Opens</Label>
          <Select
            id={`${id}-open`}
            className="h-14 text-lg"
            value={parsed.open}
            onChange={(e) => setOpen(e.target.value)}
            disabled={parsed.days.length === 0}
          >
            {TIMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-close`}>Closes</Label>
          <Select
            id={`${id}-close`}
            className="h-14 text-lg"
            value={parsed.close}
            onChange={(e) => setClose(e.target.value)}
            disabled={parsed.days.length === 0}
          >
            {TIMES.filter((t) => t.value > parsed.open).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p
        className={cn(
          "rounded-[12px] px-4 py-3 text-sm",
          preview
            ? "bg-primary-soft font-medium text-text"
            : "bg-[var(--field)] text-text-muted",
        )}
        aria-live="polite"
      >
        {preview ? (
          <>
            <span className="text-text-muted">Saved as: </span>
            {preview}
          </>
        ) : (
          "Select at least one day to set business hours."
        )}
      </p>
    </div>
  );
}
