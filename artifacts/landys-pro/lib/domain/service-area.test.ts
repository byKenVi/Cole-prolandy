import { describe, expect, it } from "vitest";
import { cleanCountyList, cleanZipList, coverageFor, parseCounty } from "./service-area";

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
