import type { LineString } from "geojson";
import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { deriveSegment } from "./derive";
import { buildGraphGeoJson, buildPinsGeoJson } from "./geojson";
import { graph, line, segment } from "./test-fixtures";

describe("deriveSegment", () => {
  it("measures length and both directions of climbing", () => {
    const derived = deriveSegment(line([0, 10, 20]));
    expect(derived.meters).toBeGreaterThan(149);
    expect(derived.meters).toBeLessThan(151);
    expect(derived.gainForward).toBe(20);
    expect(derived.gainBackward).toBe(0);
  });

  it("gives a descent no forward gain", () => {
    expect(deriveSegment(line([50, 25, 0])).gainForward).toBe(0);
    expect(deriveSegment(line([50, 25, 0])).gainBackward).toBe(50);
  });
});

describe("buildGraphGeoJson", () => {
  const g = graph({
    nodes: [
      { id: "nA", name: null, coord: [-122.33, 47.68] },
      { id: "nB", name: null, coord: [-122.328, 47.68] },
    ],
    segments: [
      segment("s1", "nA", "nB", {
        name: "Ballard Locks to Golden Gardens",
        protection: "bikePath",
        steepness: "rolling",
      }),
    ],
  });
  const geometry = new Map<string, ElevCoord[]>([["s1", line()]]);

  it("flattens every attribute into properties a Mapbox expression can read", () => {
    const collection = buildGraphGeoJson(g, geometry);
    const properties = collection.features[0].properties!;
    expect(properties.protection).toBe("bikePath");
    expect(properties.steepness).toBe("rolling");
    expect(properties.reviewed).toBe(false);
  });

  it("carries the name, which riders read on hover", () => {
    const properties = buildGraphGeoJson(g, geometry).features[0].properties!;
    expect(properties.name).toBe("Ballard Locks to Golden Gardens");
  });

  it("injects the derived numbers rather than trusting a stored copy", () => {
    const properties = buildGraphGeoJson(g, geometry).features[0].properties!;
    expect(properties.gainForward).toBe(20);
    expect(properties.meters).toBeGreaterThan(0);
  });

  it("keeps elevation in the coordinates, which the profile chart needs", () => {
    const feature = buildGraphGeoJson(g, geometry).features[0];
    const coordinates = (feature.geometry as LineString).coordinates;
    expect(coordinates[0]).toHaveLength(3);
  });

  it("refuses a segment whose geometry file is missing", () => {
    expect(() => buildGraphGeoJson(g, new Map())).toThrow(/no geometry file/);
  });

  it("builds an empty collection for an empty graph", () => {
    expect(buildGraphGeoJson(graph(), new Map()).features).toEqual([]);
  });
});

describe("buildGraphGeoJson on a crossing", () => {
  const g = graph({
    nodes: [
      { id: "nA", name: null, coord: [-122.33, 47.68] },
      { id: "nB", name: null, coord: [-122.328, 47.68] },
    ],
    segments: [
      segment("s1", "nA", "nB", {
        name: "Colman Dock to Bainbridge",
        crossing: "ferry",
      }),
    ],
  });
  const properties = buildGraphGeoJson(
    g,
    new Map<string, ElevCoord[]>([["s1", line([0, 10, 20])]]),
  ).features[0].properties!;

  it("says so, so the map can draw it as one", () => {
    expect(properties.crossing).toBe("ferry");
  });

  it("gives it no climb either way", () => {
    // The recorder was below deck, so the elevations here are interpolated
    // between two docks: any climb in them is arithmetic rather than a hill.
    expect(properties.gainForward).toBe(0);
    expect(properties.gainBackward).toBe(0);
  });

  it("still measures how far it is", () => {
    // The graph search weights it at what it costs to cross. Only the numbers
    // shown to a rider leave it out.
    expect(properties.meters).toBeGreaterThan(0);
  });

  it("leaves road saying nothing about crossings", () => {
    const road = buildGraphGeoJson(
      graph({
        nodes: [
          { id: "nA", name: null, coord: [-122.33, 47.68] },
          { id: "nB", name: null, coord: [-122.328, 47.68] },
        ],
        segments: [segment("s1", "nA", "nB")],
      }),
      new Map<string, ElevCoord[]>([["s1", line([0, 10, 20])]]),
    ).features[0].properties!;
    expect(road.crossing).toBeNull();
    expect(road.gainForward).toBe(20);
  });
});

describe("buildPinsGeoJson", () => {
  it("carries the kind and position along the segment", () => {
    const g = graph({
      segments: [segment("s1", "nA", "nB")],
      pins: [
        {
          id: "p1",
          segment: "s1",
          kind: "drinkingWater",
          note: "north end of the lot",
          at: 0.25,
          coord: [-122.329, 47.6802],
        },
      ],
    });
    const properties = buildPinsGeoJson(g).features[0].properties!;
    expect(properties.kind).toBe("drinkingWater");
    expect(properties.at).toBe(0.25);
  });

  it("refuses a pin whose segment no longer exists", () => {
    const g = graph({
      pins: [
        {
          id: "p1",
          segment: "gone",
          kind: "drinkingWater",
          note: null,
          at: 0.5,
          coord: [-122.33, 47.68],
        },
      ],
    });
    expect(() => buildPinsGeoJson(g)).toThrow(/missing segment/);
  });
});
