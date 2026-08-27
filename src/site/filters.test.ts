import { describe, expect, it } from "vitest";
import type { SiteSegment } from "./graph-data";
import {
  breakdown,
  isFiltering,
  NO_FILTERS,
  LIGHTEST_STEP,
  lightnessOf,
  passes,
  RAMPS,
  type Filters,
} from "./filters";

function segment(over: Partial<SiteSegment> = {}): SiteSegment {
  return {
    id: "s1",
    from: "nA",
    to: "nB",
    points: [
      [-122.35, 47.65, 0],
      [-122.34, 47.65, 0],
    ],
    meters: 1000,
    gainForward: 0,
    gainBackward: 0,
    steepness: "flat",
    protection: "unprotected",
    surroundings: "nice",
    surface: "asphalt",
    recommendedDirection: null,
    ...over,
  };
}

const only = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over });

describe("passes", () => {
  it("lets everything through when nothing is set", () => {
    expect(passes(segment({ steepness: "steep" }), NO_FILTERS)).toBe(true);
    expect(
      passes(
        segment({ protection: "unprotected", surface: "dirt" }),
        NO_FILTERS,
      ),
    ).toBe(true);
  });

  it("keeps out what is steeper than asked for", () => {
    const steep = segment({ steepness: "steep" });
    expect(passes(steep, only({ steepest: "hilly" }))).toBe(false);
    expect(passes(steep, only({ steepest: "steep" }))).toBe(true);
  });

  it("treats bike lane and surroundings as floors rather than ceilings", () => {
    expect(
      passes(
        segment({ protection: "unprotected" }),
        only({ leastProtection: "roadBikeLane" }),
      ),
    ).toBe(false);
    expect(
      passes(
        segment({ protection: "fullBikePath" }),
        only({ leastProtection: "roadBikeLane" }),
      ),
    ).toBe(true);
    expect(
      passes(
        segment({ surroundings: "plain" }),
        only({ leastSurroundings: "scenic" }),
      ),
    ).toBe(false);
    expect(
      passes(
        segment({ surroundings: "scenic" }),
        only({ leastSurroundings: "scenic" }),
      ),
    ).toBe(true);
  });

  it("treats surface as a set of things, not a scale", () => {
    const gravel = segment({ surface: "gravel" });
    expect(passes(gravel, only({ surfaces: ["asphalt"] }))).toBe(false);
    expect(passes(gravel, only({ surfaces: ["asphalt", "gravel"] }))).toBe(
      true,
    );
  });

  it("needs every bar cleared, not just one", () => {
    const rough = segment({ protection: "fullBikePath", surface: "dirt" });
    expect(
      passes(
        rough,
        only({ leastProtection: "fullBikePath", surfaces: ["asphalt"] }),
      ),
    ).toBe(false);
  });
});

describe("isFiltering", () => {
  it("knows when nothing has been asked for", () => {
    expect(isFiltering(NO_FILTERS)).toBe(false);
  });

  it("notices any one bar being raised", () => {
    expect(isFiltering(only({ steepest: "flat" }))).toBe(true);
    expect(isFiltering(only({ leastProtection: "roadBikeLane" }))).toBe(true);
    expect(isFiltering(only({ leastSurroundings: "scenic" }))).toBe(true);
    expect(isFiltering(only({ surfaces: ["asphalt"] }))).toBe(true);
  });
});

describe("breakdown", () => {
  it("measures in distance, not in segments", () => {
    // Nine tenths good bike lane is nine tenths whether that is one long
    // segment or twelve short ones.
    const route = [
      segment({ protection: "fullBikePath", meters: 9000 }),
      segment({ protection: "unprotected", meters: 500 }),
      segment({ protection: "unprotected", meters: 500 }),
    ];
    const [first, second] = breakdown(route, "protection");
    expect(first).toEqual({ value: "fullBikePath", meters: 9000, share: 0.9 });
    expect(second.value).toBe("unprotected");
    expect(second.share).toBeCloseTo(0.1, 9);
  });

  it("puts the biggest share first", () => {
    const route = [
      segment({ surface: "gravel", meters: 100 }),
      segment({ surface: "asphalt", meters: 900 }),
    ];
    expect(breakdown(route, "surface").map((s) => s.value)).toEqual([
      "asphalt",
      "gravel",
    ]);
  });

  it("reports the steepness a segment carries", () => {
    expect(
      breakdown([segment({ steepness: "steep" })], "steepness")[0].value,
    ).toBe("steep");
  });

  it("has nothing to divide up for an empty route", () => {
    expect(breakdown([], "surface")).toEqual([]);
  });
});

describe("the color ramps", () => {
  it("cover every value each scale can take", () => {
    expect(Object.keys(RAMPS.steepness).sort()).toEqual([
      "flat",
      "hilly",
      "steep",
    ]);
    expect(Object.keys(RAMPS.protection).sort()).toEqual([
      "fullBikePath",
      "roadBikeLane",
      "unprotected",
    ]);
    expect(Object.keys(RAMPS.surroundings).sort()).toEqual([
      "nice",
      "plain",
      "scenic",
    ]);
    expect(Object.keys(RAMPS.surface).sort()).toEqual([
      "asphalt",
      "dirt",
      "gravel",
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
