import { describe, expect, it } from "vitest";
import {
  formatBusinessHours,
  parseBusinessHours,
  formatClock,
} from "./business-hours";

describe("business-hours", () => {
  it("formats weekday range", () => {
    expect(
      formatBusinessHours({
        days: ["mon", "tue", "wed", "thu", "fri"],
        open: "07:00",
        close: "18:00",
      }),
    ).toBe("Mon to Fri, 7:00 AM to 6:00 PM");
  });

  it("formats non-consecutive days", () => {
    expect(
      formatBusinessHours({
        days: ["mon", "wed", "fri"],
        open: "08:00",
        close: "17:00",
      }),
    ).toBe("Mon, Wed, Fri, 8:00 AM to 5:00 PM");
  });

  it("parses Mon–Fri 7am–6pm style strings", () => {
    const v = parseBusinessHours("Mon–Fri 7am–6pm");
    expect(v.days).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(v.open).toBe("07:00");
    expect(v.close).toBe("18:00");
  });

  it("reads back its own format", () => {
    const samples = [
      { days: ["mon", "tue", "wed", "thu", "fri"], open: "07:00", close: "18:00" },
      { days: ["mon", "wed", "fri"], open: "08:30", close: "17:00" },
    ] as const;
    for (const sample of samples) {
      const value = { ...sample, days: [...sample.days] };
      expect(parseBusinessHours(formatBusinessHours(value))).toEqual(value);
    }
  });

  it("formatClock handles noon/midnight edges", () => {
    expect(formatClock("00:00")).toBe("12:00 AM");
    expect(formatClock("12:00")).toBe("12:00 PM");
    expect(formatClock("12:30")).toBe("12:30 PM");
  });
});
