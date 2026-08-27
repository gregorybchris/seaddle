import { describe, expect, it } from "vitest";
import { formatRideDate } from "./dates";

describe("formatRideDate", () => {
  it("reads short enough to sit in a list", () => {
    // Midday UTC, so the date is the same either side of the Atlantic and the
    // test does not depend on where it runs.
    expect(formatRideDate("2026-07-06T18:00:00Z")).toBe("6 Jul 2026");
  });

  it("handles the turn of the year", () => {
    expect(formatRideDate("2026-01-31T18:00:00Z")).toBe("31 Jan 2026");
    expect(formatRideDate("2025-12-01T18:00:00Z")).toBe("1 Dec 2025");
  });

  it("gives nothing for something that is not a date", () => {
    expect(formatRideDate("not a date")).toBe("");
  });
});
