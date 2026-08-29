import { describe, expect, it } from "vitest";
import { breakdown, LIGHTEST_STEP, lightnessOf, RAMPS } from "./encoding";
import { siteSegment as segment } from "./test-fixtures";

describe("breakdown", () => {
  it("measures in distance, not in segments", () => {
    // Nine tenths good bike lane is nine tenths whether that is one long
    // segment or twelve short ones.
    const route = [
      segment({ protection: "bikePath", meters: 9000 }),
      segment({ protection: "unprotected", meters: 500 }),
      segment({ protection: "unprotected", meters: 500 }),
    ];
    const [first, second] = breakdown(route, "protection");
    expect(first).toEqual({ value: "bikePath", meters: 9000, share: 0.9 });
    expect(second.value).toBe("unprotected");
    expect(second.share).toBeCloseTo(0.1, 9);
  });

  it("puts the biggest share first", () => {
    const route = [
      segment({ steepness: "steep", meters: 100 }),
      segment({ steepness: "flat", meters: 900 }),
    ];
    expect(breakdown(route, "steepness").map((s) => s.value)).toEqual([
      "flat",
      "steep",
    ]);
  });

  it("reports the steepness a segment carries", () => {
    expect(
      breakdown([segment({ steepness: "steep" })], "steepness")[0].value,
    ).toBe("steep");
  });

  it("has nothing to divide up for an empty route", () => {
    expect(breakdown([], "steepness")).toEqual([]);
  });
});

describe("the color ramps", () => {
  it("cover every value each scale can take", () => {
    expect(Object.keys(RAMPS.steepness).sort()).toEqual([
      "flat",
      "rolling",
      "steep",
    ]);
    expect(Object.keys(RAMPS.protection).sort()).toEqual([
      "bikeLane",
      "bikePath",
      "unprotected",
    ]);
    expect(Object.keys(RAMPS.surroundings).sort()).toEqual([
      "beautiful",
      "plain",
      "pleasant",
    ]);
  });

  it("order the ordered scales by lightness, so the order survives color blindness", () => {
    for (const scale of ["steepness", "protection", "surroundings"] as const) {
      const steps = Object.values(RAMPS[scale]).map(lightnessOf);
      const descending = steps.every((v, i) => i === 0 || v < steps[i - 1]);
      expect(descending).toBe(true);
    }
  });

  it("stay dark enough to see against a nearly white basemap", () => {
    // The failure this catches looked like the coloring not working at all:
    // a first ramp started around 203, which simply vanished into the map.
    for (const scale of Object.values(RAMPS)) {
      for (const [value, hex] of Object.entries(scale)) {
        expect({ value, lightness: Math.round(lightnessOf(hex)) }).toEqual({
          value,
          lightness: expect.any(Number),
        });
        expect(lightnessOf(hex)).toBeLessThanOrEqual(LIGHTEST_STEP);
      }
    }
  });
});
