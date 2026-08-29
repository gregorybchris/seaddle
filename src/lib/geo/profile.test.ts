import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { elevationProfile, sampleAt } from "./profile";

/** A line whose vertices are deliberately uneven: dense, then one long jump. */
function unevenClimb(): ElevCoord[] {
  return [
    [-122.33, 47.68, 0],
    [-122.3299, 47.68, 10],
    [-122.3298, 47.68, 20],
    [-122.32, 47.68, 30],
  ];
}

describe("elevationProfile", () => {
  it("returns the requested number of samples", () => {
    expect(elevationProfile(unevenClimb(), 16).samples).toHaveLength(16);
  });

  it("starts and ends at the real endpoints", () => {
    const profile = elevationProfile(unevenClimb(), 20);
    expect(profile.samples[0]).toBeCloseTo(0, 6);
    expect(profile.samples[19]).toBeCloseTo(30, 6);
  });

  it("samples by distance, not by vertex", () => {
    // Three vertices sit in the first 1% of the line and one is far away. By
    // vertex, the profile would show a climb to 20 across three quarters of the
    // width; by distance, almost all of it is the long final leg.
    const profile = elevationProfile(unevenClimb(), 100);
    const middle = profile.samples[50];
    expect(middle).toBeGreaterThan(20);
    expect(middle).toBeLessThan(30);
  });

  it("reports the range it drew", () => {
    const profile = elevationProfile(unevenClimb(), 32);
    expect(profile.minMeters).toBeCloseTo(0, 6);
    expect(profile.maxMeters).toBeCloseTo(30, 6);
    expect(profile.meters).toBeGreaterThan(700);
  });

  it("draws a flat line for flat ground", () => {
    const flat: ElevCoord[] = [
      [-122.33, 47.68, 12],
      [-122.32, 47.68, 12],
    ];
    const profile = elevationProfile(flat, 8);
    expect(new Set(profile.samples)).toEqual(new Set([12]));
    expect(profile.minMeters).toBe(profile.maxMeters);
  });

  it("survives lines too short to have a shape", () => {
    expect(elevationProfile([], 8).samples).toEqual([]);
    expect(elevationProfile([[-122.33, 47.68, 5]], 4).samples).toEqual([
      5, 5, 5, 5,
    ]);
  });
});

describe("elevationProfile across a leg nobody rides", () => {
  /** Two short climbs with a long jump between them, the way a route reads
   *  when it takes the ferry. */
  const ferried: ElevCoord[] = [
    [-122.33, 47.68, 0],
    [-122.3299, 47.68, 10],
    [-122.24, 47.68, 10],
    [-122.2399, 47.68, 20],
  ];

  it("draws the jump to no width at all", () => {
    const profile = elevationProfile(ferried, 20, new Set([2]));
    // Without this the crossing is nine tenths of the line, and both climbs
    // are squashed into the ends of the chart.
    expect(profile.meters).toBeCloseTo(
      elevationProfile(ferried.slice(0, 2), 2).meters +
        elevationProfile(ferried.slice(2), 2).meters,
      6,
    );
  });

  it("still starts and ends where the route does", () => {
    const profile = elevationProfile(ferried, 20, new Set([2]));
    expect(profile.samples[0]).toBeCloseTo(0, 6);
    expect(profile.samples[19]).toBeCloseTo(20, 6);
  });

  it("gives a line that is nothing but a crossing no length", () => {
    expect(elevationProfile(ferried, 8, new Set([1, 2, 3])).meters).toBe(0);
  });
});

describe("sampleAt", () => {
  const profile = elevationProfile(unevenClimb(), 21);

  it("reads the start and the end exactly", () => {
    expect(sampleAt(profile, 0)).toEqual({ meters: 0, elevation: 0 });
    const end = sampleAt(profile, 1)!;
    expect(end.meters).toBeCloseTo(profile.meters, 6);
    expect(end.elevation).toBeCloseTo(30, 6);
  });

  it("reports distance and height together", () => {
    const middle = sampleAt(profile, 0.5)!;
    expect(middle.meters).toBeCloseTo(profile.meters / 2, 6);
    expect(middle.elevation).toBeGreaterThan(20);
  });

  it("clamps a pointer that has run off either end of the chart", () => {
    expect(sampleAt(profile, -0.4)).toEqual(sampleAt(profile, 0));
    expect(sampleAt(profile, 1.7)).toEqual(sampleAt(profile, 1));
  });

  it("has nothing to read when there is no profile", () => {
    expect(sampleAt(elevationProfile([], 8), 0.5)).toBeNull();
  });
});
