import { readFileSync } from "node:fs";
import path from "node:path";
import type { LineString } from "geojson";
import { describe, expect, it } from "vitest";
import { haversineMeters } from "@/lib/geo/distance";
import { crop, polylineMeters, snapEnds } from "@/lib/geo/polyline";
import { roundPoint, simplify } from "@/lib/geo/simplify";
import { deriveSegment } from "@/lib/graph/derive";
import { buildGraphGeoJson } from "@/lib/graph/geojson";
import { graph, segment } from "@/lib/graph/test-fixtures";
import { parseGpx } from "@/lib/gpx/parse-gpx";
import { writeGpx } from "@/lib/gpx/write-gpx";
import type { ElevCoord } from "@/lib/models/geo";

/**
 * The whole build path, at realistic scale.
 *
 * Every other test works on hand-made lines a few points long. This one runs a
 * 450-point track through parse → crop → snap → simplify → derive → GeoJSON →
 * export, because the interesting failures only appear at real point counts
 * with real GPS scatter.
 *
 * The fixture is synthetic on purpose. Actual rides start and end at home, so
 * they stay out of the repo. This one is calibrated to the measured middle of
 * both source kinds — the real set is half drawn in Mapometer and half recorded
 * by Strava, and after import both are resampled to the same 15 m spacing.
 */
const TRACK = path.resolve("test-fixtures/sample-loop.gpx");

function loadTrack(): ElevCoord[] {
  return parseGpx(readFileSync(TRACK, "utf8")).points;
}

describe("segment extraction pipeline", () => {
  const points = loadTrack();

  it("parses the source ride", () => {
    expect(points.length).toBe(420);
    // Plausibly in Seattle, which is all the geometry cares about.
    expect(points[0][0]).toBeGreaterThan(-122.6);
    expect(points[0][0]).toBeLessThan(-122.1);
    expect(points[0][1]).toBeGreaterThan(47.4);
    expect(points[0][1]).toBeLessThan(47.9);
  });

  it("crops a sub-path that is shorter than the ride it came from", () => {
    const cropped = crop(points, 100, 250);
    expect(cropped).toHaveLength(151);
    expect(polylineMeters(cropped)).toBeLessThan(polylineMeters(points));
    expect(polylineMeters(cropped)).toBeGreaterThan(100);
  });

  it("lands the endpoints exactly on the junction coordinates", () => {
    // Anything less and segments meeting at one node end meters apart, which
    // renders as a hairline gap at every intersection on the map.
    const nodeA: [number, number] = [-122.3401, 47.6801];
    const nodeB: [number, number] = [-122.3352, 47.6772];
    const snapped = snapEnds(crop(points, 100, 250), nodeA, nodeB);
    expect(snapped[0][0]).toBe(nodeA[0]);
    expect(snapped[0][1]).toBe(nodeA[1]);
    expect(snapped[snapped.length - 1][0]).toBe(nodeB[0]);
    expect(snapped[snapped.length - 1][1]).toBe(nodeB[1]);
  });

  it("simplifies away most points without moving the line", () => {
    const cropped = crop(points, 100, 250);
    const simplified = simplify(cropped, 6).map(roundPoint);
    expect(simplified.length).toBeLessThan(cropped.length);

    const before = polylineMeters(cropped);
    const after = polylineMeters(simplified);
    // Shorter, because simplifying cuts corners — but barely. Measured across
    // the real rides, drawn and recorded alike, 6 m of tolerance costs between
    // 0.06% and 0.83% of the length.
    expect(after).toBeLessThanOrEqual(before);
    expect(before - after).toBeLessThan(before * 0.02);
  });

  it("keeps every simplified point close to the original line", () => {
    const cropped = crop(points, 100, 250);
    const simplified = simplify(cropped, 6);
    for (const point of simplified) {
      const nearest = Math.min(
        ...cropped.map((original) =>
          haversineMeters([point[0], point[1]], [original[0], original[1]]),
        ),
      );
      expect(nearest).toBeLessThan(0.01);
    }
  });

  it("derives a plausible length and climb for a real segment", () => {
    const derived = deriveSegment(simplify(crop(points, 100, 250), 6));
    expect(derived.meters).toBeGreaterThan(100);
    expect(derived.meters).toBeLessThan(10000);
    expect(derived.gainForward).toBeGreaterThanOrEqual(0);
    expect(derived.gainBackward).toBeGreaterThanOrEqual(0);
    // The fixture is nearly flat; anything near a Queen Anne climb means the
    // threshold filter has stopped working and jitter is counting as elevation.
    expect(derived.gainForward).toBeLessThan(100);
  });

  it("compiles into a feature the map can style directly", () => {
    const geometry = simplify(crop(points, 100, 250), 6).map(roundPoint);
    const collection = buildGraphGeoJson(
      graph({ segments: [segment("s1", "nA", "nB")] }),
      new Map([["s1", geometry]]),
    );
    const feature = collection.features[0];
    expect(feature.properties?.meters).toBeGreaterThan(0);
    expect((feature.geometry as LineString).coordinates).toHaveLength(
      geometry.length,
    );
  });

  it("survives a round trip out to GPX and back", () => {
    // What a user actually downloads. If export mangles coordinates, this is
    // where it shows up rather than in someone's bike computer.
    const geometry = simplify(crop(points, 100, 250), 6).map(roundPoint);
    const reparsed = parseGpx(writeGpx([geometry], "Sample segment")).points;
    expect(reparsed).toEqual(geometry);
  });
});
