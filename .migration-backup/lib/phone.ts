import { parsePhoneNumberFromString } from "libphonenumber-js/core";
import type { CountryCode } from "libphonenumber-js";
import metadataRaw from "libphonenumber-js/metadata.min.json";

// Use the core API with metadata we import ourselves. The package's default
// entry loads metadata via an internal require() that breaks under some runtimes
// (esbuild/tsx wrap the JSON as { default }, leaving metadata.countries
// undefined). Importing the JSON here and normalizing the interop makes phone
// parsing work identically in Next.js, Vitest, and one-off tsx scripts.
const metadata = (
  (metadataRaw as { countries?: unknown }).countries
    ? metadataRaw
    : (metadataRaw as unknown as { default: unknown }).default
) as Parameters<typeof parsePhoneNumberFromString>[2];

/**
 * Phone normalization to E.164 (e.g. "+15551234567").
 *
 * Used to keep contractor phone numbers in one canonical form so first-login
 * matching (Clerk-verified phone → admin-created Contractor) never fails on a
 * formatting difference like "(555) 123-4567" vs "+15551234567".
 *
 * DEFAULT COUNTRY: US. Numbers entered without a country code are assumed to be
 * US numbers. Fully-qualified numbers (starting with "+") are parsed as-is
 * regardless of the default.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "US";

/**
 * Return the E.164 form of a phone string, or null when it isn't a valid,
 * parseable number. Callers decide whether to fall back to the raw input.
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, { defaultCountry }, metadata);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

/**
 * Normalize for storage: prefer the E.164 form, but never drop the user's input
 * if it can't be parsed (keep the raw trimmed value so nothing is silently
 * lost). Use this on write paths.
 */
export function normalizePhoneForStorage(
  raw: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  return normalizePhone(raw, defaultCountry) ?? raw.trim();
}
