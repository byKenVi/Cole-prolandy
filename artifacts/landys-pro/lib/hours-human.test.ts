import { describe, expect, it } from "vitest";
import { hoursToHuman } from "@/lib/hours-human";

describe("hoursToHuman", () => {
  it("converts whole days", () => {
    expect(hoursToHuman(24)).toBe("1 day");
    expect(hoursToHuman(72)).toBe("3 days");
    expect(hoursToHuman(168)).toBe("7 days");
    expect(hoursToHuman(336)).toBe("14 days");
  });
});
