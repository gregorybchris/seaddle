import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { buildAdjacency } from "@/lib/graph/adjacency";
import type { SiteGraph, SiteSegment } from "./graph-data";
import {
  append,
  canAppend,
  continuations,
  EMPTY_ROUTE,
  isEmpty,
  liveEnds,
  routeGain,
  routeMeters,
  routePoints,
  routeProfile,
  startRoute,
  undo,
} from "./route";

/**
 * A line of three segments with a spur, so there is somewhere to branch:
 *
 *   nA --s1-- nB --s2-- nC --s3-- nD
 *              |
 *             s4
 *              |
 *             nE
 */
function segment(
  id: string,
  from: string,
  to: string,
  elevations: [number, number],
): SiteSegment {
  const points: ElevCoord[] = [
    [-122.35, 47.65, elevations[0]],
    [-122.34, 47.65, (elevations[0] + elevations[1]) / 2],
    [-122.33, 47.65, elevations[1]],
  ];
  return {
    id,
    from,
    to,
    points,
    meters: 1000,
    gainForward: Math.max(0, elevations[1] - elevations[0]),
    gainBackward: Math.max(0, elevations[0] - elevations[1]),
    difficulty: { forward: "medium", backward: "medium" },
    laneQuality: "fair",
    scenic: "medium",
    surface: "asphalt",
    recommendedDirection: null,
  };
}

function graph(): SiteGraph {
  const all = [
    segment("s1", "nA", "nB", [0, 50]),
    segment("s2", "nB", "nC", [50, 60]),
    segment("s3", "nC", "nD", [60, 20]),
    segment("s4", "nB", "nE", [50, 90]),
  ];
  return {
    segments: new Map(all.map((s) => [s.id, s])),
    adjacency: buildAdjacency(all),
    bounds: { minLon: -122.35, minLat: 47.65, maxLon: -122.33, maxLat: 47.65 },
  };
}

const G = graph();
const seg = (id: string) => G.segments.get(id)!;

describe("starting a route", () => {
  it("begins with nothing chosen", () => {
    expect(isEmpty(EMPTY_ROUTE)).toBe(true);
    expect(liveEnds(EMPTY_ROUTE)).toEqual([]);
  });

  it("offers every segment before anything is picked", () => {
    expect(continuations(EMPTY_ROUTE, G).size).toBe(4);
  });

  it("leaves both ends live after the first segment", () => {
    // Direction is not decided yet: the second click is what picks a side.
    const route = startRoute(seg("s1"));
    expect(route.ambiguous).toBe(true);
    expect(liveEnds(route).sort()).toEqual(["nA", "nB"]);
  });

  it("offers the neighbours of both ends while undecided", () => {
    const route = startRoute(seg("s2"));
    expect([...continuations(route, G)].sort()).toEqual(["s1", "s3", "s4"]);
  });
});

describe("growing a route", () => {
  it("resolves direction on the second segment", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    expect(route.ambiguous).toBe(false);
    expect(route.steps.map((s) => s.segment)).toEqual(["s1", "s2"]);
    expect(liveEnds(route)).toEqual(["nC"]);
  });

  it("flips the first segment when the second is behind it", () => {
    // Clicking the neighbour behind you means you meant to ride the other way,
    // not that you made a mistake.
    const route = append(startRoute(seg("s2")), seg("s1"));
    expect(route.steps[0]).toEqual({ segment: "s2", from: "nC", to: "nB" });
    expect(route.steps[1]).toEqual({ segment: "s1", from: "nB", to: "nA" });
  });

  it("only offers what touches the live end once direction is settled", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    expect([...continuations(route, G)]).toEqual(["s3"]);
  });

  it("will not attach a segment that touches nothing live", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    expect(canAppend(route, seg("s4"), G)).toBe(false);
    expect(append(route, seg("s4"))).toEqual(route);
  });

  it("never offers the segment just ridden, so a route cannot double back in place", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    expect(continuations(route, G).has("s2")).toBe(false);
  });

  it("reports a dead end as nothing to offer", () => {
    let route = append(startRoute(seg("s1")), seg("s2"));
    route = append(route, seg("s3"));
    expect(continuations(route, G).size).toBe(0);
  });
});

describe("undo", () => {
  it("pops the last segment", () => {
    let route = append(startRoute(seg("s1")), seg("s2"));
    route = append(route, seg("s3"));
    expect(undo(route).steps.map((s) => s.segment)).toEqual(["s1", "s2"]);
  });

  it("makes both ends live again on the way back to one segment", () => {
    const route = undo(append(startRoute(seg("s1")), seg("s2")));
    expect(route.ambiguous).toBe(true);
    expect(liveEnds(route).sort()).toEqual(["nA", "nB"]);
  });

  it("empties out", () => {
    expect(isEmpty(undo(startRoute(seg("s1"))))).toBe(true);
  });
});

describe("what the route measures", () => {
  it("adds up distance", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    expect(routeMeters(route, G)).toBe(2000);
  });

  it("gives a range while the direction is undecided", () => {
    // s3 drops 40m one way and climbs it the other, and saying one number
    // would be picking an answer and presenting it as fact.
    expect(routeGain(startRoute(seg("s3")), G)).toEqual({ min: 0, max: 40 });
  });

  it("collapses to one number once direction is settled", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    expect(routeGain(route, G)).toEqual({ min: 60, max: 60 });
  });

  it("counts the climb of the direction actually ridden", () => {
    const downhill = append(startRoute(seg("s2")), seg("s1"));
    expect(routeGain(downhill, G)).toEqual({ min: 0, max: 0 });
  });
});

describe("route geometry", () => {
  it("joins the segments without repeating the junction between them", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    expect(routePoints(route, G)).toHaveLength(5);
  });

  it("reverses a segment ridden backwards", () => {
    const route = append(startRoute(seg("s2")), seg("s1"));
    const points = routePoints(route, G);
    expect(points[0][2]).toBe(60);
    expect(points[points.length - 1][2]).toBe(0);
  });

  it("profiles the whole route, not each segment", () => {
    const route = append(startRoute(seg("s1")), seg("s2"));
    const profile = routeProfile(route, G);
    expect(profile.samples[0]).toBeCloseTo(0, 6);
    expect(profile.samples[profile.samples.length - 1]).toBeCloseTo(60, 6);
  });

  it("has nothing to draw for an empty route", () => {
    expect(routePoints(EMPTY_ROUTE, G)).toEqual([]);
  });
});
