/** Weekly business-hours helpers — stored as a human-readable string on Contractor. */

export const DAYS = [
  { key: "mon", label: "Mon", short: "M" },
  { key: "tue", label: "Tue", short: "T" },
  { key: "wed", label: "Wed", short: "W" },
  { key: "thu", label: "Thu", short: "T" },
  { key: "fri", label: "Fri", short: "F" },
  { key: "sat", label: "Sat", short: "S" },
  { key: "sun", label: "Sun", short: "S" },
] as const;

export type DayKey = (typeof DAYS)[number]["key"];

export type BusinessHoursValue = {
  days: DayKey[];
  open: string; // "07:00" 24h
  close: string; // "18:00" 24h
};

const DAY_ALIASES: Record<string, DayKey> = {
  mon: "mon",
  monday: "mon",
  tue: "tue",
  tues: "tue",
  tuesday: "tue",
  wed: "wed",
  wednesday: "wed",
  thu: "thu",
  thur: "thu",
  thurs: "thu",
  thursday: "thu",
  fri: "fri",
  friday: "fri",
  sat: "sat",
  saturday: "sat",
  sun: "sun",
  sunday: "sun",
};

/** 30-minute slots from 05:00 to 22:00 */
export function timeOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = 5; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m > 0) continue;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      out.push({ value, label: formatClock(value) });
    }
  }
  return out;
}

export function formatClock(hhmm: string): string {
  const [hs, ms] = hhmm.split(":").map(Number);
  const h = hs ?? 0;
  const m = ms ?? 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function dayLabel(key: DayKey): string {
  return DAYS.find((d) => d.key === key)?.label ?? key;
}

/** Collapse consecutive days: Mon–Fri, or list Mon, Wed, Fri */
function formatDayRange(days: DayKey[]): string {
  if (days.length === 0) return "";
  const order = DAYS.map((d) => d.key);
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const indices = sorted.map((d) => order.indexOf(d));

  const ranges: string[] = [];
  let start = indices[0]!;
  let prev = indices[0]!;

  for (let i = 1; i <= indices.length; i++) {
    const cur = indices[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    const a = order[start]!;
    const b = order[prev]!;
    ranges.push(start === prev ? dayLabel(a) : `${dayLabel(a)}–${dayLabel(b)}`);
    if (cur !== undefined) {
      start = cur;
      prev = cur;
    }
  }
  return ranges.join(", ");
}

export function formatBusinessHours(v: BusinessHoursValue): string {
  if (v.days.length === 0) return "";
  const days = formatDayRange(v.days);
  return `${days} ${formatClock(v.open)} – ${formatClock(v.close)}`;
}

export function defaultBusinessHours(): BusinessHoursValue {
  return {
    days: ["mon", "tue", "wed", "thu", "fri"],
    open: "07:00",
    close: "18:00",
  };
}

/** Best-effort parse of stored strings like "Mon–Fri 7am–6pm". */
export function parseBusinessHours(raw: string | null | undefined): BusinessHoursValue {
  const fallback = defaultBusinessHours();
  if (!raw?.trim()) return { ...fallback, days: [] };

  const text = raw.trim().toLowerCase().replace(/–|—/g, "-");

  // Days: "mon-fri" or "mon, wed, fri"
  const dayPart = text.split(/\s+\d/)[0] ?? text;
  const days: DayKey[] = [];

  const rangeMatch = dayPart.match(
    /\b(mon|tue|tues|wednesday|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|thursday|friday|saturday|sunday)\s*-\s*(mon|tue|tues|wednesday|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|thursday|friday|saturday|sunday)\b/,
  );
  if (rangeMatch) {
    const order = DAYS.map((d) => d.key);
    const a = DAY_ALIASES[rangeMatch[1]!];
    const b = DAY_ALIASES[rangeMatch[2]!];
    if (a && b) {
      const i0 = order.indexOf(a);
      const i1 = order.indexOf(b);
      for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) days.push(order[i]!);
    }
  } else {
    for (const token of dayPart.split(/[,\s/]+/)) {
      const key = DAY_ALIASES[token.replace(/\./g, "")];
      if (key && !days.includes(key)) days.push(key);
    }
  }

  // Times: 7am, 7:00am, 07:00, 6pm
  const times = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)];
  let open = fallback.open;
  let close = fallback.close;
  if (times.length >= 2) {
    open = toHhmm(times[0]!);
    close = toHhmm(times[1]!);
  } else if (times.length === 1) {
    open = toHhmm(times[0]!);
  }

  return {
    days: days.length > 0 ? days : fallback.days,
    open,
    close,
  };
}

function toHhmm(m: RegExpMatchArray): string {
  let h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h <= 23) {
    // already 24h-ish
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
