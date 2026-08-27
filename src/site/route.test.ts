import { describe, expect, it } from "vitest";
import { boundsOf } from "@/lib/geo/bounds";
import { buildAdjacency } from "@/lib/graph/adjacency";
import type { ElevCoord } from "@/lib/models/geo";
import type { SiteGraph, SiteSegment } from "./graph-data";
import {
  append,
  canAppend,
  choiceBounds,
  continuations,
  decodeRoute,
  decodeStages,
  EMPTY_ROUTE,
  encodeRoute,
  focusAnchor,
  isEmpty,
  liveEnds,
  outAndBack,
  routeBounds,
  routeGain,
  routeMeters,
  routePoints,
  routeProfile,
  startRoute,
} from "./route";

/**
 * A graph with both kinds of junction in it:
 *
 *                        s5 — nF
 *   nA —s1— nB —s2— nC —s3— nD
 *            |           \  s6 — nG
 *           s4
 *            |
 *           nE
 *
 * nB and nD are forks. nC carries exactly two segments, so arriving there
 * leaves nothing to decide — it is a bend in the road, not a choice.
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
    name: null,
    from,
    to,
    points,
    meters: 1000,
    gainForward: Math.max(0, elevations[1] - elevations[0]),
    gainBackward: Math.max(0, elevations[0] - elevations[1]),
    steepness: "flat",
    protection: "unprotected",
    surroundings: "pleasant",
    recommendedDirection: null,
  };
}

function graph(): SiteGraph {
  const all = [
    segment("s1", "nA", "nB", [0, 50]),
    segment("s2", "nB", "nC", [50, 60]),
    segment("s3", "nC", "nD", [60, 20]),
    segment("s4", "nB", "nE", [50, 90]),
    segment("s5", "nD", "nF", [20, 30]),
    segment("s6", "nD", "nG", [20, 10]),
  ];
  return {
    segments: new Map(all.map((s) => [s.id, s])),
    adjacency: buildAdjacency(all),
    bounds: { minLon: -122.35, minLat: 47.65, maxLon: -122.33, maxLat: 47.65 },
  };
}

const G = graph();
const seg = (id: string) => G.segments.get(id)!;
const ids = (route: { steps: { segment: string }[] }) =>
  route.steps.map((step) => step.segment);

describe("starting a route", () => {
  it("begins with nothing chosen", () => {
    expect(isEmpty(EMPTY_ROUTE)).toBe(true);
    expect(liveEnds(EMPTY_ROUTE)).toEqual([]);
  });

  it("offers every segment before anything is picked", () => {
    expect(continuations(EMPTY_ROUTE, G).size).toBe(6);
  });

  it("leaves both ends live after the first segment", () => {
    // Direction is not decided yet: the second click is what picks a side.
    const route = startRoute(seg("s1"));
    expect(route.ambiguous).toBe(true);
    expect(liveEnds(route).sort()).toEqual(["nA", "nB"]);
  });

  it("does not run on from the opening segment", () => {
    // Both ends are still live, so the choice on offer is which way to ride —
    // a real one, even where each end has a single road leading off it.
    expect(ids(startRoute(seg("s2")))).toEqual(["s2"]);
  });

  it("offers the neighbors of both ends while undecided", () => {
    const route = startRoute(seg("s2"));
    expect([...continuations(route, G)].sort()).toEqual(["s1", "s3", "s4"]);
  });
});

describe("growing a route", () => {
  it("resolves direction on the second segment", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    expect(route.ambiguous).toBe(false);
    expect(ids(route)).toEqual(["s1", "s4"]);
    expect(liveEnds(route)).toEqual(["nE"]);
  });

  it("flips the first segment when the second is behind it", () => {
    // Clicking the neighbor behind you means you meant to ride the other way,
    // not that you made a mistake.
    const route = append(startRoute(seg("s2")), seg("s1"), G);
    expect(route.steps[0]).toEqual({
      segment: "s2",
      from: "nC",
      to: "nB",
      auto: false,
    });
    expect(route.steps[1]).toEqual({
      segment: "s1",
      from: "nB",
      to: "nA",
      auto: false,
    });
  });

  it("will not attach a segment that touches nothing live", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    expect(canAppend(route, seg("s2"), G)).toBe(false);
    expect(append(route, seg("s2"), G)).toEqual(route);
  });

  it("refuses to double back down the road it arrived on", () => {
    // The highlighting says this is not allowed, so the model must agree —
    // otherwise the two disagree the moment a caller forgets to check.
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    expect(append(route, seg("s4"), G)).toEqual(route);
  });

  it("reports a dead end as nothing to offer", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    expect(continuations(route, G).size).toBe(0);
  });
});

describe("junctions with nothing to decide", () => {
  it("runs on through a two-segment junction", () => {
    // Picking s2 from nB lands at nC, where s3 is the only way on, so the
    // route carries through rather than asking for a click to confirm it.
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(ids(route)).toEqual(["s1", "s2", "s3"]);
    expect(liveEnds(route)).toEqual(["nD"]);
  });

  it("marks what it added itself, and what was chosen", () => {
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(route.steps.map((step) => step.auto)).toEqual([false, false, true]);
  });

  it("stops at the next real fork", () => {
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect([...continuations(route, G)].sort()).toEqual(["s5", "s6"]);
  });

  it("counts the distance and climb of everything it ran through", () => {
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(routeMeters(route, G)).toBe(3000);
    expect(routeGain(route, G)).toEqual({ min: 60, max: 60 });
  });

  it("does not circle forever around a ring with no forks", () => {
    // Every junction on a loop can carry exactly two segments, in which case
    // there is never a fork to stop at.
    const ring = [
      segment("r1", "n1", "n2", [0, 0]),
      segment("r2", "n2", "n3", [0, 0]),
      segment("r3", "n3", "n1", [0, 0]),
    ];
    const looped: SiteGraph = {
      segments: new Map(ring.map((s) => [s.id, s])),
      adjacency: buildAdjacency(ring),
      bounds: G.bounds,
    };
    const route = append(
      startRoute(looped.segments.get("r1")!),
      looped.segments.get("r2")!,
      looped,
    );
    expect(ids(route)).toEqual(["r1", "r2", "r3"]);
  });
});

describe("the history a link carries", () => {
  it("hands back the route as it stood after each decision", () => {
    const stages = decodeStages("s1,s4", G);
    expect(stages.map(ids)).toEqual([[], ["s1"], ["s1", "s4"]]);
  });

  it("steps back one decision, not one segment", () => {
    // s3 came along with the choice of s2, so it goes back with it — otherwise
    // one click would need two presses to undo.
    const stages = decodeStages("s1,s2", G);
    expect(ids(stages[stages.length - 1])).toEqual(["s1", "s2", "s3"]);
    expect(ids(stages[stages.length - 2])).toEqual(["s1"]);
  });

  it("starts at nothing, so the opening segment can be taken back too", () => {
    expect(isEmpty(decodeStages("s1", G)[0])).toBe(true);
    expect(decodeStages("", G)).toEqual([EMPTY_ROUTE]);
  });

  it("makes both ends live again on the way back to one segment", () => {
    const [, single] = decodeStages("s1,s4", G);
    expect(single.ambiguous).toBe(true);
    expect(liveEnds(single).sort()).toEqual(["nA", "nB"]);
  });

  it("leaves out a token that changed nothing", () => {
    // A segment a recut has since removed would otherwise sit in the history
    // as a step that undoes nothing.
    expect(decodeStages("s1,s404,s4", G).map(ids)).toEqual([
      [],
      ["s1"],
      ["s1", "s4"],
    ]);
  });
});

describe("what the route measures", () => {
  it("adds up distance", () => {
    expect(routeMeters(append(startRoute(seg("s1")), seg("s4"), G), G)).toBe(
      2000,
    );
  });

  it("gives a range while the direction is undecided", () => {
    // s3 drops 40m one way and climbs it the other, and saying one number
    // would be picking an answer and presenting it as fact.
    expect(routeGain(startRoute(seg("s3")), G)).toEqual({ min: 0, max: 40 });
  });

  it("counts the climb of the direction actually ridden", () => {
    const downhill = append(startRoute(seg("s4")), seg("s1"), G);
    expect(routeGain(downhill, G)).toEqual({ min: 0, max: 0 });
  });
});

describe("route geometry", () => {
  it("joins the segments without repeating the junction between them", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    expect(routePoints(route, G)).toHaveLength(5);
  });

  it("reverses a segment ridden backwards", () => {
    const route = append(startRoute(seg("s4")), seg("s1"), G);
    const points = routePoints(route, G);
    expect(points[0][2]).toBe(90);
    expect(points[points.length - 1][2]).toBe(0);
  });

  it("profiles the whole route, not each segment", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    const profile = routeProfile(route, G);
    expect(profile.samples[0]).toBeCloseTo(0, 6);
    expect(profile.samples[profile.samples.length - 1]).toBeCloseTo(90, 6);
  });

  it("has nothing to draw for an empty route", () => {
    expect(routePoints(EMPTY_ROUTE, G)).toEqual([]);
  });
});

describe("what the map should be framing", () => {
  it("frames the choices, not the road already ridden", () => {
    // Standing at nD after running through nC, the choices are s5 and s6.
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    const covering = boundsOf([...seg("s5").points, ...seg("s6").points]);
    expect(choiceBounds(route, G)).toEqual(covering);
  });

  it("covers every branch when there is more than one way on", () => {
    const bounds = choiceBounds(startRoute(seg("s1")), G)!;
    const covering = boundsOf([...seg("s2").points, ...seg("s4").points]);
    expect(bounds.minLon).toBeCloseTo(covering.minLon, 9);
    expect(bounds.maxLon).toBeCloseTo(covering.maxLon, 9);
  });

  it("has nothing to frame before a route starts", () => {
    expect(choiceBounds(EMPTY_ROUTE, G)).toBeNull();
  });

  it("has nothing to frame at a dead end, so the view is left alone", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    expect(choiceBounds(route, G)).toBeNull();
  });
});

describe("out and back", () => {
  it("rides the chain home again", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    const there = outAndBack(route);
    expect(ids(there)).toEqual(["s1", "s4", "s4", "s1"]);
  });

  it("ends where it started", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    const there = outAndBack(route);
    expect(liveEnds(there)).toEqual([route.steps[0].from]);
  });

  it("doubles the distance and counts the climb of the way home", () => {
    // s1 climbs 50 and s4 climbs 40, so coming back down them climbs nothing;
    // the return leg's climb is whatever the outbound descended.
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    const there = outAndBack(route);
    expect(routeMeters(there, G)).toBe(routeMeters(route, G) * 2);
    expect(routeGain(there, G)).toEqual({ min: 90, max: 90 });
  });

  it("comes off in one press, because turning round was one decision", () => {
    const stages = decodeStages("s1,s4,~", G);
    expect(ids(stages[stages.length - 1])).toEqual(["s1", "s4", "s4", "s1"]);
    expect(ids(stages[stages.length - 2])).toEqual(["s1", "s4"]);
  });

  it("has nothing to mirror when no route has started", () => {
    expect(outAndBack(EMPTY_ROUTE)).toEqual(EMPTY_ROUTE);
  });
});

describe("carrying a route in a link", () => {
  it("stores the choices and not what followed from them", () => {
    // s3 came along by itself, so the graph can supply it again.
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(encodeRoute(route)).toBe("s1,s2");
  });

  it("comes back as the same ride", () => {
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(decodeRoute(encodeRoute(route), G)).toEqual(route);
  });

  it("says 'and back' rather than naming the road twice", () => {
    // Riding back down the road you arrived on is the one thing append
    // refuses, so a link cannot describe it as another segment.
    const there = outAndBack(append(startRoute(seg("s1")), seg("s4"), G));
    expect(encodeRoute(there)).toBe("s1,s4,~");
    expect(decodeRoute(encodeRoute(there), G)).toEqual(there);
  });

  it("keeps the direction a flipped opening segment settled on", () => {
    const flipped = append(startRoute(seg("s2")), seg("s1"), G);
    expect(decodeRoute(encodeRoute(flipped), G)).toEqual(flipped);
  });

  it("gives back what still exists when a link has gone stale", () => {
    // Segments get recut, and half a remembered ride beats an error.
    expect(ids(decodeRoute("s1,s404,s4", G))).toEqual(["s1", "s4"]);
  });

  it("reads an empty link as no route at all", () => {
    expect(decodeRoute("", G)).toEqual(EMPTY_ROUTE);
    expect(encodeRoute(EMPTY_ROUTE)).toBe("");
  });
});

describe("where the map should hold still", () => {
  it("anchors on the end of the route, where the next choice is", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    const points = routePoints(route, G);
    const last = points[points.length - 1];
    expect(focusAnchor(route, G)).toEqual([last[0], last[1]]);
  });

  it("anchors on the middle of an opening segment, which has no end yet", () => {
    // Both its ends are live, so holding either one still would favor a
    // direction the rider has not chosen.
    const anchor = focusAnchor(startRoute(seg("s1")), G)!;
    const points = routePoints(startRoute(seg("s1")), G);
    expect(anchor).not.toEqual([points[0][0], points[0][1]]);
    expect(anchor).not.toEqual([
      points[points.length - 1][0],
      points[points.length - 1][1],
    ]);
  });

  it("has nothing to anchor on before a route starts", () => {
    expect(focusAnchor(EMPTY_ROUTE, G)).toBeNull();
    expect(routeBounds(EMPTY_ROUTE, G)).toBeNull();
  });

  it("covers the whole ride when it is being looked at rather than built", () => {
    const route = append(startRoute(seg("s1")), seg("s4"), G);
    expect(routeBounds(route, G)).toEqual(boundsOf(routePoints(route, G)));
  });
});
