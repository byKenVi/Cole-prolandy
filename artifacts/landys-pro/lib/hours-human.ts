/** Human-readable equivalent for hour-based admin settings. Units stay hours in the DB. */
export function hoursToHuman(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const rounded = Math.round(hours * 10) / 10;
  if (rounded % 24 === 0) {
    const days = rounded / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (rounded < 24) {
    return rounded === 1 ? "1 hour" : `${rounded} hours`;
  }
  const days = Math.floor(rounded / 24);
  const rem = Math.round((rounded % 24) * 10) / 10;
  const dayPart = days === 1 ? "1 day" : `${days} days`;
  if (rem === 0) return dayPart;
  const hourPart = rem === 1 ? "1 hour" : `${rem} hours`;
  return `${dayPart} ${hourPart}`;
}
