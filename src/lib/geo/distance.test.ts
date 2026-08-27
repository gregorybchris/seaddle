import { describe, expect, it } from "vitest";
import {
  fromLocalMeters,
  haversineMeters,
  metersPerDegreeLat,
  metersPerDegreeLon,
  toLocalMeters,
} from "./distance";

const GAS_WORKS: [number, number] = [-122.3343, 47.6456];

describe("haversineMeters", () => {
  it("measures a hundredth of a degree of latitude", () => {
    const meters = haversineMeters([-122.35, 47.65], [-122.35, 47.66]);
    expect(meters).toBeGreaterThan(1111);
    expect(meters).toBeLessThan(1113);
  });

  it("measures a hundredth of a degree of longitude, foreshortened at Seattle's latitude", () => {
    const meters = haversineMeters([-122.35, 47.65], [-122.34, 47.65]);
    expect(meters).toBeGreaterThan(748);
    expect(meters).toBeLessThan(750);
  });

  it("is zero for a point against itself", () => {
    expect(haversineMeters(GAS_WORKS, GAS_WORKS)).toBe(0);
  });

  it("is symmetric", () => {
    const there = haversineMeters(GAS_WORKS, [-122.31, 47.66]);
    const back = haversineMeters([-122.31, 47.66], GAS_WORKS);
    expect(there).toBeCloseTo(back, 9);
  });
});

describe("degree scaling", () => {
  it("shrinks a degree of longitude away from the equator", () => {
    expect(metersPerDegreeLon(0)).toBeCloseTo(metersPerDegreeLat(), 3);
    expect(metersPerDegreeLon(47.65)).toBeLessThan(metersPerDegreeLat() * 0.7);
  });
});

describe("local projection", () => {
  it("round-trips a coordinate back to itself", () => {
    const target: [number, number] = [-122.3, 47.67];
    const local = toLocalMeters(target, GAS_WORKS);
    const [lon, lat] = fromLocalMeters(local, GAS_WORKS);
    expect(lon).toBeCloseTo(target[0], 9);
    expect(lat).toBeCloseTo(target[1], 9);
  });

  it("agrees with the great circle over a segment-sized distance", () => {
    const target: [number, number] = [-122.325, 47.6495];
    const local = toLocalMeters(target, GAS_WORKS);
    const flat = Math.hypot(local.x, local.y);
    const sphere = haversineMeters(GAS_WORKS, target);
    // A couple of centimetres of disagreement across ~800 m — three orders of
    // magnitude inside GPS noise, and the flat version is what perpendicular
    // distance and projection need.
    expect(Math.abs(flat - sphere)).toBeLessThan(0.1);
  });
});
