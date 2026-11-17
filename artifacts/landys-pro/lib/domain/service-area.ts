import {
  distanceMiles,
  lookupCounty,
  lookupZip,
  lookupZips,
  normalizeCountyName,
  normalizeZip,
  type CountyInfo,
  type ZipInfo,
} from "@/lib/geo/zip";

export { normalizeCountyName };

/**
 * Service-area matching.
 *
 * A request is located by a ZIP (older forms, phone requests) or by a county
 * (the current landys.co form only asks for the county).
 *
 * For a ZIP, a contractor covers the request when ANY of these is true:
 *   1. the ZIP is one of the contractor's service ZIPs;
 *   2. the ZIP is within the contractor's radius (or the global default) of
 *      one of their service ZIPs;
 *   3. the ZIP is inside one of the contractor's service counties.
 *
 * For a county, when ANY of these is true:
 *   1. the county is one of the contractor's service counties;
 *   2. one of the contractor's service ZIPs is inside the county;
 *   3. the county's centre is within the contractor's radius of one of their
 *      service ZIPs.
 *
 * Contractors with no service area at all are only used as a fallback, when
 * nobody with a declared area covers the request (see `selectContractorsForLocation`).
 */

export type ServiceAreaContractor = {
  serviceZipCodes: string[];
  serviceCounties: string[];
  serviceRadiusMiles: number | null;
};

export const DEFAULT_SERVICE_RADIUS_MILES = 50;

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY", "PR",
]);

export type ParsedCounty = { name: string; state: string | null };

/** Parse "Sabine County, TX", "Sabine County", "Sabine, TX", "Sabine County TX". */
export function parseCounty(raw: string): ParsedCounty | null {
  let text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  let state: string | null = null;
  const withState = text.match(/^(.*?)[,\s]+([A-Za-z]{2})\.?$/);
  if (withState && US_STATE_CODES.has(withState[2].toUpperCase())) {
    text = withState[1];
    state = withState[2].toUpperCase();
  }
  const name = normalizeCountyName(text);
  return name ? { name, state } : null;
}

/** Split CMS values like "75204, 75205; 75212" or arrays into clean strings. */
export function splitList(value: unknown): string[] {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string") {
      for (const piece of v.split(/[,;\n|]+/)) {
        const trimmed = piece.trim();
        if (trimmed) parts.push(trimmed);
      }
    } else if (typeof v === "number" && Number.isFinite(v)) {
      parts.push(String(v));
    }
  };
  if (Array.isArray(value)) value.forEach(push);
  else push(value);
  return [...new Set(parts)];
}

/** Clean ZIP list: keeps only valid 5-digit ZIPs, de-duplicated. */
export function cleanZipList(value: unknown): string[] {
  const out = new Set<string>();
  for (const part of splitList(value)) {
    const zip = normalizeZip(part);
    if (zip) out.add(zip);
  }
  return [...out];
}

/** County lists can contain commas inside "Sabine County, TX"; split on ; | and newlines first. */
export function cleanCountyList(value: unknown): string[] {
  const raw: string[] = [];
  const push = (v: unknown) => {
    if (typeof v !== "string") return;
    for (const chunk of v.split(/[;\n|]+/)) {
      // "Sabine County, Newton County" → two counties; "Sabine County, TX" → one.
      const pieces = chunk.split(",").map((p) => p.trim()).filter(Boolean);
      for (let i = 0; i < pieces.length; i += 1) {
        const next = pieces[i + 1];
        if (next && US_STATE_CODES.has(next.toUpperCase())) {
          raw.push(`${pieces[i]}, ${next.toUpperCase()}`);
          i += 1;
        } else {
          raw.push(pieces[i]);
        }
      }
    }
  };
  if (Array.isArray(value)) value.forEach(push);
  else push(value);
  return [...new Set(raw.filter((c) => parseCounty(c)))];
}

export function hasServiceArea(contractor: ServiceAreaContractor): boolean {
  return (
    contractor.serviceZipCodes.some((zip) => normalizeZip(zip)) ||
    contractor.serviceCounties.some((county) => parseCounty(county))
  );
}

export type CoverageReason = "zip" | "radius" | "county";

export async function coverageFor(
  contractor: ServiceAreaContractor,
  leadZipRaw: string | null | undefined,
  defaultRadiusMiles: number,
  leadInfo?: ZipInfo | null,
): Promise<{ covered: boolean; reason: CoverageReason | null; distanceMiles: number | null }> {
  const leadZip = normalizeZip(leadZipRaw);
  if (!leadZip) return { covered: false, reason: null, distanceMiles: null };

  const serviceZips = contractor.serviceZipCodes
    .map((zip) => normalizeZip(zip))
    .filter((zip): zip is string => Boolean(zip));
  if (serviceZips.includes(leadZip)) {
    return { covered: true, reason: "zip", distanceMiles: 0 };
  }

  const lead = leadInfo === undefined ? await lookupZip(leadZip) : leadInfo;
  if (!lead) return { covered: false, reason: null, distanceMiles: null };

  const radius = contractor.serviceRadiusMiles && contractor.serviceRadiusMiles > 0
    ? contractor.serviceRadiusMiles
    : defaultRadiusMiles;
  const zipInfos = await lookupZips(serviceZips);
  let closest: number | null = null;
  for (const info of zipInfos.values()) {
    const d = distanceMiles(lead, info);
    if (closest === null || d < closest) closest = d;
  }
  if (closest !== null && closest <= radius) {
    return { covered: true, reason: "radius", distanceMiles: Math.round(closest) };
  }

  const contractorStates = new Set([...zipInfos.values()].map((info) => info.state));
  const leadCounty = normalizeCountyName(lead.county);
  for (const raw of contractor.serviceCounties) {
    const county = parseCounty(raw);
    if (!county || county.name !== leadCounty) continue;
    const stateOk = county.state
      ? county.state === lead.state
      : contractorStates.size === 0 || contractorStates.has(lead.state);
    if (stateOk) return { covered: true, reason: "county", distanceMiles: closest === null ? null : Math.round(closest) };
  }

  return { covered: false, reason: null, distanceMiles: closest === null ? null : Math.round(closest) };
}

/** Does the contractor cover a request located by county (see the header)? */
export async function coverageForCounty(
  contractor: ServiceAreaContractor,
  county: CountyInfo,
  defaultRadiusMiles: number,
): Promise<{ covered: boolean; reason: CoverageReason | null; distanceMiles: number | null }> {
  const target = normalizeCountyName(county.name);
  for (const raw of contractor.serviceCounties) {
    const parsed = parseCounty(raw);
    if (!parsed || parsed.name !== target) continue;
    if (!parsed.state || parsed.state === county.state) {
      return { covered: true, reason: "county", distanceMiles: 0 };
    }
  }

  const zipInfos = await lookupZips(
    contractor.serviceZipCodes.map((zip) => normalizeZip(zip)).filter((zip): zip is string => Boolean(zip)),
  );
  for (const info of zipInfos.values()) {
    if (info.state === county.state && normalizeCountyName(info.county) === target) {
      return { covered: true, reason: "zip", distanceMiles: 0 };
    }
  }

  const radius =
    contractor.serviceRadiusMiles && contractor.serviceRadiusMiles > 0
      ? contractor.serviceRadiusMiles
      : defaultRadiusMiles;
  let closest: number | null = null;
  for (const info of zipInfos.values()) {
    const d = distanceMiles(county, info);
    if (closest === null || d < closest) closest = d;
  }
  if (closest !== null && closest <= radius) {
    return { covered: true, reason: "radius", distanceMiles: Math.round(closest) };
  }
  return { covered: false, reason: null, distanceMiles: closest === null ? null : Math.round(closest) };
}

/**
 * The county a stored location designates ("Sabine County, TX"), or null when
 * the location is a ZIP or cannot be read. A county without a state is read
 * as a Texas county: landys.co only serves Texas today.
 */
export async function countyOfLocation(location: string | null | undefined): Promise<CountyInfo | null> {
  if (!location?.trim() || normalizeZip(location)) return null;
  const parsed = parseCounty(location);
  if (!parsed) return null;
  return lookupCounty(parsed.name, parsed.state ?? "TX");
}

/**
 * Pick the contractors who should receive a request located by a ZIP or a
 * county. Contractors with a declared area win; contractors without any area
 * are a fallback used only when no declared area covers the request.
 */
export async function selectContractorsForLocation<T extends ServiceAreaContractor>(
  contractors: readonly T[],
  location: string | null | undefined,
  defaultRadiusMiles: number,
): Promise<{ eligible: T[]; usedFallback: boolean }> {
  const county = await countyOfLocation(location);
  if (!county) return selectContractorsForZip(contractors, location, defaultRadiusMiles);
  const zoned: T[] = [];
  const withoutArea: T[] = [];
  for (const contractor of contractors) {
    if (!hasServiceArea(contractor)) {
      withoutArea.push(contractor);
      continue;
    }
    const { covered } = await coverageForCounty(contractor, county, defaultRadiusMiles);
    if (covered) zoned.push(contractor);
  }
  if (zoned.length > 0) return { eligible: zoned, usedFallback: false };
  return { eligible: withoutArea, usedFallback: withoutArea.length > 0 };
}

/**
 * Pick the contractors who should receive a lead in `leadZip`.
 * Contractors with a declared service area win; contractors without any area
 * are a fallback used only when no declared area covers the lead.
 */
export async function selectContractorsForZip<T extends ServiceAreaContractor>(
  contractors: readonly T[],
  leadZipRaw: string | null | undefined,
  defaultRadiusMiles: number,
): Promise<{ eligible: T[]; usedFallback: boolean }> {
  const leadInfo = await lookupZip(leadZipRaw);
  const zoned: T[] = [];
  const withoutArea: T[] = [];
  for (const contractor of contractors) {
    if (!hasServiceArea(contractor)) {
      withoutArea.push(contractor);
      continue;
    }
    const { covered } = await coverageFor(contractor, leadZipRaw, defaultRadiusMiles, leadInfo);
    if (covered) zoned.push(contractor);
  }
  if (zoned.length > 0) return { eligible: zoned, usedFallback: false };
  return { eligible: withoutArea, usedFallback: withoutArea.length > 0 };
}
