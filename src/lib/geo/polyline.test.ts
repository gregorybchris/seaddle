import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { haversineMeters } from "@/lib/geo/distance";
import {
  coordAtFraction,
  crop,
  densify,
  cumulativeMeters,
  elevationGain,
  polylineMeters,
  projectOntoPolyline,
  reversed,
  snapEnds,
} from "./polyline";

/** A straight run east along a parallel, so distances are easy to reason about. */
const LINE: ElevCoord[] = [
  [-122.33, 47.68, 10],
  [-122.32, 47.68, 20],
  [-122.31, 47.68, 15],
];

describe("polylineMeters", () => {
  it("sums the legs", () => {
    expect(polylineMeters(LINE)).toBeGreaterThan(1497);
    expect(polylineMeters(LINE)).toBeLessThan(1499);
  });

  it("is zero for a single point", () => {
    expect(polylineMeters([LINE[0]])).toBe(0);
  });
});

describe("cumulativeMeters", () => {
  it("starts at zero and ends at the total", () => {
    const cumulative = cumulativeMeters(LINE);
    expect(cumulative).toHaveLength(LINE.length);
    expect(cumulative[0]).toBe(0);
    expect(cumulative[2]).toBeCloseTo(polylineMeters(LINE), 6);
  });
});

describe("elevationGain", () => {
  it("adds up the climbs", () => {
    expect(elevationGain(pts([0, 5, 10]))).toBe(10);
  });

  it("ignores jitter below the threshold", () => {
    // Raw GPX wobbles by a meter between neighboring points; summing every
    // positive delta would invent hundreds of feet of climbing on a flat trail.
    expect(elevationGain(pts([0, 1, 0, 1, 0, 1, 0]))).toBe(0);
  });

  it("counts a climb, a descent, and another climb", () => {
    expect(elevationGain(pts([0, 10, 5, 15]))).toBe(20);
  });

  it("differs by direction", () => {
    const up = pts([0, 10, 5, 15]);
    expect(elevationGain(up)).toBe(20);
    expect(elevationGain(reversed(up))).toBe(5);
  });

  it("is zero for fewer than two points", () => {
    expect(elevationGain([])).toBe(0);
    expect(elevationGain(pts([100]))).toBe(0);
  });
});

describe("projectOntoPolyline", () => {
  it("finds the foot of the perpendicular", () => {
    const projection = projectOntoPolyline(LINE, [-122.325, 47.682]);
    expect(projection.index).toBe(0);
    expect(projection.coord[0]).toBeCloseTo(-122.325, 5);
    expect(projection.coord[1]).toBeCloseTo(47.68, 5);
    expect(projection.distanceMeters).toBeGreaterThan(220);
    expect(projection.distanceMeters).toBeLessThan(224);
  });

  it("clamps past the end rather than running off the line", () => {
    const projection = projectOntoPolyline(LINE, [-122.18, 47.68]);
    expect(projection.fraction).toBe(1);
    expect(projection.coord[0]).toBeCloseTo(-122.31, 6);
  });

  it("reports position as a fraction usable as a pin's `at`", () => {
    const projection = projectOntoPolyline(LINE, [-122.32, 47.68]);
    expect(projection.fraction).toBeCloseTo(0.5, 2);
  });

  it("refuses an empty line", () => {
    expect(() => projectOntoPolyline([], [-122.28, 47.63])).toThrow();
  });
});

describe("coordAtFraction", () => {
  it("inverts a projection", () => {
    const target: [number, number] = [-122.3175, 47.68];
    const fraction = projectOntoPolyline(LINE, target).fraction;
    const [lon, lat] = coordAtFraction(LINE, fraction);
    expect(lon).toBeCloseTo(target[0], 5);
    expect(lat).toBeCloseTo(target[1], 5);
  });

  it("clamps out-of-range fractions to the ends", () => {
    expect(coordAtFraction(LINE, -1)[0]).toBeCloseTo(-122.33, 6);
    expect(coordAtFraction(LINE, 2)[0]).toBeCloseTo(-122.31, 6);
  });
});

describe("crop", () => {
  const track = pts([0, 1, 2, 3, 4]);

  it("takes an inclusive slice", () => {
    expect(crop(track, 1, 3).map((p) => p[2])).toEqual([1, 2, 3]);
  });

  it("reverses when the indices run backwards", () => {
    // A track riding B → A is a fine source for the segment A → B; stored
    // geometry just has to come out running from → to.
    expect(crop(track, 3, 1).map((p) => p[2])).toEqual([3, 2, 1]);
  });

  it("returns a single point when the indices match", () => {
    expect(crop(track, 2, 2).map((p) => p[2])).toEqual([2]);
  });
});

describe("snapEnds", () => {
  it("moves the endpoints onto the junctions and leaves the middle alone", () => {
    const snapped = snapEnds(LINE, [-122.3301, 47.6801], [-122.3099, 47.6799]);
    expect(snapped[0]).toEqual([-122.3301, 47.6801, 10]);
    expect(snapped[1]).toEqual(LINE[1]);
    expect(snapped[2]).toEqual([-122.3099, 47.6799, 15]);
  });

  it("keeps the original elevations", () => {
    const snapped = snapEnds(LINE, [-122.38, 47.73], [-122.18, 47.63]);
    expect(snapped[0][2]).toBe(10);
    expect(snapped[2][2]).toBe(15);
  });
});

/** Elevations along one arbitrary line — only the third value matters here. */
function pts(elevations: number[]): ElevCoord[] {
  return elevations.map((ele, i) => [-122.33 + i * 0.001, 47.68, ele]);
}

describe("densify", () => {
  const sparse: ElevCoord[] = [
    [-122.33, 47.68, 0],
    [-122.32, 47.68, 60],
  ];

  it("leaves a line that is already dense enough alone", () => {
    expect(densify(LINE, 2000)).toEqual(LINE);
  });

  it("breaks up a gap wider than the limit", () => {
    const dense = densify(sparse, 100);
    expect(dense.length).toBeGreaterThan(2);
    for (let i = 1; i < dense.length; i++) {
      expect(
        haversineMeters(
          [dense[i - 1][0], dense[i - 1][1]],
          [dense[i][0], dense[i][1]],
        ),
      ).toBeLessThanOrEqual(100);
    }
  });

  it("keeps the original points, so nothing moves", () => {
    const dense = densify(sparse, 100);
    expect(dense[0]).toEqual(sparse[0]);
    expect(dense[dense.length - 1]).toEqual(sparse[1]);
    expect(polylineMeters(dense)).toBeCloseTo(polylineMeters(sparse), 3);
  });

  it("interpolates elevation along the way", () => {
    const dense = densify(sparse, 400);
    expect(dense).toHaveLength(3);
    expect(dense[1][2]).toBeCloseTo(30, 6);
  });

  it("passes through lines too short to have a gap", () => {
    expect(densify([], 15)).toEqual([]);
    expect(densify([sparse[0]], 15)).toEqual([sparse[0]]);
  });
});
