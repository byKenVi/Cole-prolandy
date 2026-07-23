import { describe, it, expect } from "vitest";
import { normalizePhone, normalizePhoneForStorage } from "./phone";

describe("phone normalization (E.164, default US)", () => {
  it("collapses different formats of the SAME number to one canonical value", () => {
    // Uses a valid NANP number (415 area code); the fictional 555 area code is
    // rejected by isValid() and would fall back to raw.
    const formats = [
      "(415) 234-5678",
      "415-234-5678",
      "4152345678",
      "+1 415 234 5678",
      "+14152345678",
    ];
    const canonical = formats.map((f) => normalizePhone(f));
    // Every format resolves to the same E.164 string.
    expect(new Set(canonical).size).toBe(1);
    expect(canonical[0]).toBe("+14152345678");
  });

  it("MATCHES admin-entered format against a Clerk-provided E.164 number", () => {
    // The exact scenario from the audit: admin types a formatted number, Clerk
    // sends E.164. Both sides must normalize to the same value or the first-
    // login backfill silently misses and duplicates the contractor.
    const adminEntered = normalizePhoneForStorage("(415) 234-5678"); // write side
    const clerkVerified = normalizePhone("+14152345678"); // match side
    expect(adminEntered).toBe(clerkVerified);
    expect(adminEntered).toBe("+14152345678");
  });

  it("returns null for unparseable input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });

  it("storage helper keeps raw (trimmed) input when it can't be parsed", () => {
    expect(normalizePhoneForStorage("  not-a-phone  ")).toBe("not-a-phone");
  });

  it("respects a non-US default country when provided", () => {
    // UK number entered without +44, default GB.
    expect(normalizePhone("020 7946 0958", "GB")).toBe("+442079460958");
  });
});
