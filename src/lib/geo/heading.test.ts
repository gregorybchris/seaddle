import { describe, expect, it } from "vitest";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import { bearingDegrees, compassPoint, departureHeading } from "./heading";

const HUB: Coord = [-122.34, 47.65];

/** Roughly a degree of latitude and of longitude at Seattle, in meters. */
const LAT = 111_320;
const LON = 75_000;

/** A point `north` meters up and `east` meters across from the hub. */
function from(north: number, east: number): Coord {
  return [HUB[0] + east / LON, HUB[1] + north / LAT];
}

describe("bearingDegrees", () => {
  it("reads the four cardinal directions", () => {
    expect(bearingDegrees(HUB, from(200, 0))).toBeCloseTo(0, 0);
    expect(bearingDegrees(HUB, from(0, 200))).toBeCloseTo(90, 0);
    expect(bearingDegrees(HUB, from(-200, 0))).toBeCloseTo(180, 0);
    expect(bearingDegrees(HUB, from(0, -200))).toBeCloseTo(270, 0);
  });

  it("always reports a positive angle", () => {
    // Anything west of north comes out of atan2 negative, and a compass does
    // not have negative directions on it.
    for (const west of [1, 50, 200, 5000]) {
      expect(bearingDegrees(HUB, from(200, -west))).toBeGreaterThan(180);
    }
  });
});

describe("compassPoint", () => {
  it("names the eight points", () => {
    expect(compassPoint(0)).toBe("north");
    expect(compassPoint(45)).toBe("north-east");
    expect(compassPoint(90)).toBe("east");
    expect(compassPoint(180)).toBe("south");
    expect(compassPoint(315)).toBe("north-west");
  });

  it("rounds to the nearest point rather than down to it", () => {
    expect(compassPoint(20)).toBe("north");
    expect(compassPoint(25)).toBe("north-east");
  });

  it("wraps rather than falling off either end", () => {
    expect(compassPoint(359)).toBe("north");
    expect(compassPoint(360)).toBe("north");
    expect(compassPoint(-45)).toBe("north-west");
  });
});

describe("departureHeading", () => {
  const at = (coord: Coord, ele = 0): ElevCoord => [coord[0], coord[1], ele];

  it("reports the way the road sets off, not where it ends up", () => {
    // Leaves due north, then bends right round and finishes south of where it
    // started. End to end this reads "south", which is the opposite of the
    // turn a rider at the junction would be making.
    const hooked = [
      at(HUB),
      at(from(100, 0)),
      at(from(160, 60)),
      at(from(100, 120)),
      at(from(-80, 120)),
    ];
    expect(compassPoint(departureHeading(hooked)!)).toBe("north");
  });

  it("uses the far end when the road is shorter than the window", () => {
    const stub = [at(HUB), at(from(0, 12))];
    expect(compassPoint(departureHeading(stub, 40)!)).toBe("east");
  });

  it("has nothing to say about a single point", () => {
    expect(departureHeading([at(HUB)])).toBeNull();
    expect(departureHeading([])).toBeNull();
  });
});
