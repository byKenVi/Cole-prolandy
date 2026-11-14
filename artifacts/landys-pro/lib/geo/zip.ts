/**
 * US ZIP code lookup (centroid, city, state, county). SERVER-SIDE ONLY:
 * never import this from a client component (the data file is ~2 MB).
 *
 * Data: GeoNames US postal codes (https://www.geonames.org/), licensed under
 * Creative Commons Attribution 4.0. See `lib/geo/README.md`.
 */

export type ZipInfo = {
  zip: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  county: string;
};

type ZipRow = [number, number, string, string, string];

let table: Record<string, ZipRow> | null = null;
let loading: Promise<Record<string, ZipRow>> | null = null;

async function loadTable(): Promise<Record<string, ZipRow>> {
  if (table) return table;
  if (!loading) {
    loading = import("./us-zip-codes.json").then((mod) => {
      const data = ((mod as { default?: unknown }).default ?? mod) as Record<string, ZipRow>;
      table = data;
      return data;
    });
  }
  return loading;
}

/** First five digits of a US ZIP (accepts "75204", "75204-1234", " 75204 "). */
export function normalizeZip(raw: string | null | undefined): string | null {
  const match = raw?.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match ? match[1] : null;
}

export async function lookupZip(raw: string | null | undefined): Promise<ZipInfo | null> {
  const zip = normalizeZip(raw);
  if (!zip) return null;
  const rows = await loadTable();
  const row = rows[zip];
  if (!row) return null;
  return { zip, lat: row[0], lng: row[1], city: row[2], state: row[3], county: row[4] };
}

export async function lookupZips(raws: readonly string[]): Promise<Map<string, ZipInfo>> {
  const out = new Map<string, ZipInfo>();
  for (const raw of raws) {
    const info = await lookupZip(raw);
    if (info) out.set(info.zip, info);
  }
  return out;
}

/** Great-circle distance in miles. */
export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Hemphill, TX 75948" — falls back to the raw ZIP when unknown. */
export async function formatZipPlace(raw: string | null | undefined): Promise<string> {
  const info = await lookupZip(raw);
  if (!info) return raw?.trim() || "";
  return `${info.city}, ${info.state} ${info.zip}`;
}

/** "Hemphill, TX" — or null when unknown. */
export async function zipCityState(raw: string | null | undefined): Promise<string | null> {
  const info = await lookupZip(raw);
  return info ? `${info.city}, ${info.state}` : null;
}

/** Primary IANA time zone per state (good enough for quiet hours). */
const STATE_TIME_ZONES: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DC: "America/New_York",
  DE: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Boise", IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/Detroit", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
  NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver", PR: "America/Puerto_Rico",
};

export const DEFAULT_TIME_ZONE = "America/Chicago";

export function timeZoneForState(state: string | null | undefined): string {
  return (state && STATE_TIME_ZONES[state.toUpperCase()]) || DEFAULT_TIME_ZONE;
}

export async function timeZoneForZip(raw: string | null | undefined): Promise<string> {
  const info = await lookupZip(raw);
  return timeZoneForState(info?.state);
}
