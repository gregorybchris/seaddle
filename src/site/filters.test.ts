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
    difficulty: { forward: "medium", backward: "medium" },
    laneQuality: "fair",
    scenic: "medium",
    surface: "asphalt",
    recommendedDirection: null,
    ...over,
  };
}

const only = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over });

describe("passes", () => {
  it("lets everything through when nothing is set", () => {
    expect(
      passes(
        segment({ difficulty: { forward: "hard", backward: "hard" } }),
        NO_FILTERS,
      ),
    ).toBe(true);
    expect(
      passes(segment({ laneQuality: "poor", surface: "dirt" }), NO_FILTERS),
    ).toBe(true);
  });

  it("keeps out what is harder than asked for", () => {
    const hard = segment({ difficulty: { forward: "hard", backward: "hard" } });
    expect(passes(hard, only({ hardestDifficulty: "medium" }))).toBe(false);
    expect(passes(hard, only({ hardestDifficulty: "hard" }))).toBe(true);
  });

  it("judges a hill by its easier direction", () => {
    // Brutal one way and gentle the other is not a hill someone avoiding hills
    // has to avoid — they will ride it downhill.
    const oneWayHill = segment({
      difficulty: { forward: "hard", backward: "easy" },
    });
    expect(passes(oneWayHill, only({ hardestDifficulty: "easy" }))).toBe(true);
  });

  it("treats bike lane and scenic as floors rather than ceilings", () => {
    expect(
      passes(
        segment({ laneQuality: "poor" }),
        only({ leastLaneQuality: "good" }),
      ),
    ).toBe(false);
    expect(
      passes(
        segment({ laneQuality: "great" }),
        only({ leastLaneQuality: "good" }),
      ),
    ).toBe(true);
    expect(
      passes(segment({ scenic: "low" }), only({ leastScenic: "high" })),
    ).toBe(false);
    expect(
      passes(segment({ scenic: "high" }), only({ leastScenic: "high" })),
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
    const rough = segment({ laneQuality: "great", surface: "dirt" });
    expect(
      passes(rough, only({ leastLaneQuality: "great", surfaces: ["asphalt"] })),
    ).toBe(false);
  });
});

describe("isFiltering", () => {
  it("knows when nothing has been asked for", () => {
    expect(isFiltering(NO_FILTERS)).toBe(false);
  });

  it("notices any one bar being raised", () => {
    expect(isFiltering(only({ hardestDifficulty: "easy" }))).toBe(true);
    expect(isFiltering(only({ leastLaneQuality: "good" }))).toBe(true);
    expect(isFiltering(only({ leastScenic: "high" }))).toBe(true);
    expect(isFiltering(only({ surfaces: ["asphalt"] }))).toBe(true);
  });
});

describe("breakdown", () => {
  it("measures in distance, not in segments", () => {
    // Nine tenths good bike lane is nine tenths whether that is one long
    // segment or twelve short ones.
    const route = [
      segment({ laneQuality: "great", meters: 9000 }),
      segment({ laneQuality: "poor", meters: 500 }),
      segment({ laneQuality: "poor", meters: 500 }),
    ];
    const [first, second] = breakdown(route, "laneQuality");
    expect(first).toEqual({ value: "great", meters: 9000, share: 0.9 });
    expect(second.value).toBe("poor");
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

  it("labels a two-directional hill by its harder way", () => {
    // Which is what decides whether a rider can manage it at all.
    const route = [
      segment({ difficulty: { forward: "hard", backward: "easy" } }),
    ];
    expect(breakdown(route, "difficulty")[0].value).toBe("hard");
  });

  it("has nothing to divide up for an empty route", () => {
    expect(breakdown([], "surface")).toEqual([]);
  });
});

describe("the color ramps", () => {
  it("cover every value each scale can take", () => {
    expect(Object.keys(RAMPS.difficulty).sort()).toEqual([
      "easy",
      "hard",
      "medium",
    ]);
    expect(Object.keys(RAMPS.laneQuality).sort()).toEqual([
      "fair",
      "good",
      "great",
      "poor",
    ]);
    expect(Object.keys(RAMPS.scenic).sort()).toEqual(["high", "low", "medium"]);
    expect(Object.keys(RAMPS.surface).sort()).toEqual([
      "asphalt",
      "dirt",
      "gravel",
    ]);
  });

  it("order the ordered scales by lightness, so the order survives color blindness", () => {
    for (const scale of ["difficulty", "laneQuality", "scenic"] as const) {
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
