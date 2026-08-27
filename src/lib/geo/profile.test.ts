import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { elevationProfile, sampleAt } from "./profile";

/** A line whose vertices are deliberately uneven: dense, then one long jump. */
function unevenClimb(): ElevCoord[] {
  return [
    [-122.35, 47.65, 0],
    [-122.3499, 47.65, 10],
    [-122.3498, 47.65, 20],
    [-122.34, 47.65, 30],
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
      [-122.35, 47.65, 12],
      [-122.34, 47.65, 12],
    ];
    const profile = elevationProfile(flat, 8);
    expect(new Set(profile.samples)).toEqual(new Set([12]));
    expect(profile.minMeters).toBe(profile.maxMeters);
  });

  it("survives lines too short to have a shape", () => {
    expect(elevationProfile([], 8).samples).toEqual([]);
    expect(elevationProfile([[-122.35, 47.65, 5]], 4).samples).toEqual([
      5, 5, 5, 5,
    ]);
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
