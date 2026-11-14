/**
 * SMS quiet hours: no texts before 8:00 or from 21:00 in the recipient's local
 * time (TCPA good practice). Emails are never delayed.
 */
export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 8;

function localParts(now: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour: hour === 24 ? 0 : hour, minute };
}

/** Earliest moment an SMS may be sent: `now`, or the next 8:00 local time. */
export function nextSmsSendTime(now: Date, timeZone: string): Date {
  let local: { hour: number; minute: number };
  try {
    local = localParts(now, timeZone);
  } catch {
    return now;
  }
  const { hour, minute } = local;
  let minutesToWait = 0;
  if (hour >= QUIET_START_HOUR) {
    minutesToWait = (24 - hour + QUIET_END_HOUR) * 60 - minute;
  } else if (hour < QUIET_END_HOUR) {
    minutesToWait = (QUIET_END_HOUR - hour) * 60 - minute;
  }
  if (minutesToWait <= 0) return now;
  return new Date(now.getTime() + minutesToWait * 60_000);
}
