import { beforeAll, describe, expect, it } from "vitest";
import { lookupCounty } from "@/lib/geo/zip";
import {
  cleanCountyList,
  cleanZipList,
  countyOfLocation,
  coverageFor,
  parseCounty,
  selectContractorsForLocation,
} from "./service-area";

// The ZIP dataset is a large JSON file: load it (and the county index) once,
// so a busy machine running the whole suite does not hit the 5 s test timeout.
beforeAll(async () => {
  await lookupCounty("Sabine", "TX");
}, 60_000);

describe("service area parsing", () => {
  it("reads ZIP lists written as text or arrays", () => {
    expect(cleanZipList("75204, 75205; 75212")).toEqual(["75204", "75205", "75212"]);
    expect(cleanZipList(["75204-1234", "bad", 75948])).toEqual(["75204", "75948"]);
  });

  it("keeps the state attached to its county", () => {
    expect(cleanCountyList("Sabine County, TX, Newton County")).toEqual(["Sabine County, TX", "Newton County"]);
    expect(parseCounty("St. Mary Parish, LA")).toEqual({ name: "saint mary", state: "LA" });
    expect(parseCounty("Sabine County")).toEqual({ name: "sabine", state: null });
  });

  it("matches a county only in the right state when the state is known", async () => {
    const area = { serviceZipCodes: [], serviceCounties: ["Sabine County, LA"], serviceRadiusMiles: null };
    expect((await coverageFor(area, "75948", 50)).covered).toBe(false); // Sabine County, TX
    const tx = { ...area, serviceCounties: ["Sabine County, TX"] };
    expect((await coverageFor(tx, "75948", 50)).covered).toBe(true);
  });
});

describe("requests located by county (landys.co form)", () => {
  const none = { serviceZipCodes: [] as string[], serviceCounties: [] as string[], serviceRadiusMiles: null };

  it("reads a county location and ignores ZIPs", async () => {
    expect((await countyOfLocation("Sabine County, TX"))?.name).toBe("Sabine");
    expect((await countyOfLocation("Angelina County"))?.state).toBe("TX");
    expect(await countyOfLocation("75948")).toBeNull();
    expect(await countyOfLocation("Nowhere County, TX")).toBeNull();
  });

  it("covers a county listed, a county holding a service ZIP, or one within the radius", async () => {
    const listed = { ...none, serviceCounties: ["Sabine County, TX"] };
    const zipInside = { ...none, serviceZipCodes: ["75948"] }; // Hemphill, Sabine County
    const nearby = { ...none, serviceZipCodes: ["75901"], serviceRadiusMiles: 60 }; // Lufkin
    const farAway = { ...none, serviceZipCodes: ["78701"] }; // Austin
    const noArea = { ...none };
    const { eligible, usedFallback } = await selectContractorsForLocation(
      [listed, zipInside, nearby, farAway, noArea],
      "Sabine County, TX",
      50,
    );
    expect(eligible).toEqual([listed, zipInside, nearby]);
    expect(usedFallback).toBe(false);
  });

  it("falls back to contractors without an area when nobody covers the county", async () => {
    const farAway = { ...none, serviceZipCodes: ["78701"] };
    const noArea = { ...none };
    const result = await selectContractorsForLocation([farAway, noArea], "Sabine County, TX", 50);
    expect(result).toEqual({ eligible: [noArea], usedFallback: true });
  });

  it("still routes ZIP requests exactly as before", async () => {
    const zipInside = { ...none, serviceZipCodes: ["75948"] };
    const result = await selectContractorsForLocation([zipInside], "75948", 50);
    expect(result.eligible).toEqual([zipInside]);
  });
});
