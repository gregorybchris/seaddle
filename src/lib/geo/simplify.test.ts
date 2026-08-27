import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { roundPoint, simplify } from "./simplify";

describe("simplify", () => {
  it("collapses collinear points", () => {
    const straight: ElevCoord[] = [
      [-122.35, 47.65, 0],
      [-122.34, 47.65, 0],
      [-122.33, 47.65, 0],
      [-122.32, 47.65, 0],
    ];
    expect(simplify(straight, 6)).toHaveLength(2);
  });

  it("keeps a corner that matters", () => {
    const corner: ElevCoord[] = [
      [-122.35, 47.65, 0],
      [-122.34, 47.66, 0],
      [-122.33, 47.65, 0],
    ];
    expect(simplify(corner, 6)).toHaveLength(3);
  });

  it("drops a deviation smaller than the tolerance", () => {
    // ~1 m off a straight line, which is GPS wobble rather than a real bend.
    const wobble: ElevCoord[] = [
      [-122.35, 47.65, 0],
      [-122.34, 47.65001, 0],
      [-122.33, 47.65, 0],
    ];
    expect(simplify(wobble, 6)).toHaveLength(2);
  });

  it("always keeps both endpoints, which are snapped to junctions", () => {
    const line = noisyLine(500);
    const simplified = simplify(line, 6);
    expect(simplified[0]).toEqual(line[0]);
    expect(simplified[simplified.length - 1]).toEqual(line[line.length - 1]);
  });

  it("preserves elevation on the points it keeps", () => {
    const climb: ElevCoord[] = [
      [-122.35, 47.65, 0],
      [-122.34, 47.66, 42],
      [-122.33, 47.65, 7],
    ];
    expect(simplify(climb, 6).map((p) => p[2])).toEqual([0, 42, 7]);
  });

  it("passes through lines too short to simplify", () => {
    const pair: ElevCoord[] = [
      [-122.35, 47.65, 0],
      [-122.34, 47.65, 0],
    ];
    expect(simplify(pair, 6)).toEqual(pair);
    expect(simplify([], 6)).toEqual([]);
  });

  it("cuts a realistic track down substantially", () => {
    const line = noisyLine(2000);
    expect(simplify(line, 6).length).toBeLessThan(line.length / 2);
  });

  it("survives an input long enough to overflow a recursive implementation", () => {
    // The whole reason the algorithm is written with an explicit stack: a bad
    // split on a long track would otherwise recurse until it crashed the build,
    // and no unit test of the output would have caught it. A zigzag under a
    // tight tolerance is the worst case — every point survives, so the split
    // never stops early. Sized just past the longest real source track.
    const long: ElevCoord[] = Array.from({ length: 6000 }, (_, i) => [
      -122.35 + i * 0.00001,
      47.65 + (i % 2) * 0.0000001,
      0,
    ]);
    expect(() => simplify(long, 0.0001)).not.toThrow();
  });
});

describe("roundPoint", () => {
  it("trims float noise without coarsening the line", () => {
    // Six places is about 11 cm — an order finer than the simplification
    // tolerance, so rounding cannot add stair-stepping of its own.
    expect(roundPoint([-122.3512345678, 47.6512345678, 12.3456])).toEqual([
      -122.351235, 47.651235, 12.3,
    ]);
  });
});

function noisyLine(count: number): ElevCoord[] {
  // Deterministic pseudo-noise: a sine wave sampled off-period, so it looks
  // like GPS scatter without a random seed making the test flaky.
  return Array.from({ length: count }, (_, i) => [
    -122.35 + i * 0.00005,
    47.65 + Math.sin(i * 0.7) * 0.00002,
    10 + Math.sin(i * 0.13) * 20,
  ]);
}
