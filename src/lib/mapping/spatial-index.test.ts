import { describe, expect, it } from "vitest";
import type { Coord } from "@/lib/models/geo";
import { SpatialIndex } from "./spatial-index";

/** A grid of points 0.001° apart — roughly 111 m north-south. */
function grid(): { coord: Coord; item: string }[] {
  const entries: { coord: Coord; item: string }[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      entries.push({
        coord: [-122.35 + col * 0.001, 47.65 + row * 0.001],
        item: `${row},${col}`,
      });
    }
  }
  return entries;
}

describe("SpatialIndex", () => {
  it("finds a point sitting exactly on the query", () => {
    const index = new SpatialIndex(grid(), 200);
    const hits = index.within([-122.35, 47.65], 1);
    expect(hits).toHaveLength(1);
    expect(hits[0].item).toBe("0,0");
    expect(hits[0].distanceMeters).toBeCloseTo(0, 6);
  });

  it("returns hits nearest first", () => {
    const index = new SpatialIndex(grid(), 200);
    const hits = index.within([-122.3495, 47.6505], 200);
    const distances = hits.map((h) => h.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("agrees with a brute-force scan", () => {
    // The grid exists to make queries fast, not to change the answer.
    const entries = grid();
    const index = new SpatialIndex(entries, 300);
    const query: Coord = [-122.3462, 47.6533];
    const radius = 250;
    const found = new Set(index.within(query, radius).map((h) => h.item));
    const expected = new Set(
      entries
        .filter(
          (e) =>
            Math.hypot(
              (e.coord[0] - query[0]) * 74900,
              (e.coord[1] - query[1]) * 111195,
            ) <= radius,
        )
        .map((e) => e.item),
    );
    expect(found).toEqual(expected);
  });

  it("excludes points beyond the radius", () => {
    const index = new SpatialIndex(grid(), 500);
    const hits = index.within([-122.35, 47.65], 120);
    for (const hit of hits) expect(hit.distanceMeters).toBeLessThanOrEqual(120);
    expect(hits.map((h) => h.item)).toContain("1,0");
    expect(hits.map((h) => h.item)).not.toContain("2,0");
  });

  it("refuses a radius wider than a cell, which the 3×3 scan cannot cover", () => {
    const index = new SpatialIndex(grid(), 100);
    expect(() => index.within([-122.35, 47.65], 400)).toThrow(
      /exceeds the index cell size/,
    );
  });

  it("returns nothing for an empty index or a far-away query", () => {
    expect(
      new SpatialIndex<string>([], 100).within([-122.3, 47.6], 50),
    ).toEqual([]);
    const index = new SpatialIndex(grid(), 200);
    expect(index.within([-100, 40], 200)).toEqual([]);
  });

  it("gives the closest point, or null when nothing is in range", () => {
    const index = new SpatialIndex(grid(), 200);
    expect(index.nearest([-122.3491, 47.6501], 200)?.item).toBe("0,1");
    expect(index.nearest([-122.35, 47.65], 0.001)?.item).toBe("0,0");
    expect(index.nearest([-100, 40], 100)).toBeNull();
  });
});
