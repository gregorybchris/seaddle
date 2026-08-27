import { describe, expect, it } from "vitest";
import { boundsCenter, boundsOf, centeredOn, padBounds } from "./bounds";

const BOX = { minLon: -122.4, minLat: 47.6, maxLon: -122.2, maxLat: 47.7 };

describe("boundsOf", () => {
  it("covers every point", () => {
    expect(
      boundsOf([
        [-122.4, 47.6, 0],
        [-122.2, 47.7, 0],
        [-122.3, 47.65, 0],
      ]),
    ).toEqual(BOX);
  });

  it("refuses to take the bounds of nothing", () => {
    expect(() => boundsOf([])).toThrow();
  });
});

describe("centeredOn", () => {
  it("puts the anchor exactly in the middle", () => {
    // Fitting a map to a box centers that box, so squaring it up around a
    // chosen point is what keeps the point still between one fit and the next.
    const anchor: [number, number] = [-122.25, 47.68];
    const center = boundsCenter(centeredOn(anchor, BOX));
    expect(center[0]).toBeCloseTo(anchor[0], 12);
    expect(center[1]).toBeCloseTo(anchor[1], 12);
  });

  it("still covers everything the original box did", () => {
    const grown = centeredOn([-122.25, 47.68], BOX);
    expect(grown.minLon).toBeLessThanOrEqual(BOX.minLon);
    expect(grown.maxLon).toBeGreaterThanOrEqual(BOX.maxLon);
    expect(grown.minLat).toBeLessThanOrEqual(BOX.minLat);
    expect(grown.maxLat).toBeGreaterThanOrEqual(BOX.maxLat);
  });

  it("changes nothing when the anchor is already the middle", () => {
    // Compared loosely: squaring a box up around its own center is arithmetic
    // on floats, not a copy.
    const same = centeredOn(boundsCenter(BOX), BOX);
    for (const edge of ["minLon", "minLat", "maxLon", "maxLat"] as const) {
      expect(same[edge]).toBeCloseTo(BOX[edge], 9);
    }
  });

  it("reaches as far the other way as the furthest edge", () => {
    // An anchor on one edge doubles the box, which is the cost of holding it
    // still.
    const grown = centeredOn([BOX.minLon, BOX.minLat], BOX);
    expect(grown.maxLon - grown.minLon).toBeCloseTo(
      (BOX.maxLon - BOX.minLon) * 2,
      12,
    );
  });
});

describe("padBounds", () => {
  it("grows a box by a distance on the ground", () => {
    const padded = padBounds(BOX, 1000);
    expect(padded.minLat).toBeLessThan(BOX.minLat);
    expect(padded.maxLat).toBeGreaterThan(BOX.maxLat);
  });
});
