import { boundsOf } from "@/lib/geo/bounds";
import { buildAdjacency } from "@/lib/graph/adjacency";
import type { SiteGraph, SiteSegment } from "./graph-data";

/**
 * A segment with everything filled in, so a test only writes what it is about.
 *
 * The site's tests each want a different corner of a segment — an elevation
 * pair, a set of points, an attribute — and each was carrying its own copy of
 * the other nine fields to get at it.
 */
export function siteSegment(over: Partial<SiteSegment> = {}): SiteSegment {
  return {
    id: "s1",
    name: null,
    from: "nA",
    to: "nB",
    points: [
      [-122.33, 47.68, 0],
      [-122.32, 47.68, 0],
    ],
    meters: 1000,
    gainForward: 0,
    gainBackward: 0,
    steepness: "flat",
    protection: "unprotected",
    surroundings: "pleasant",
    crossing: null,
    ...over,
  };
}

/** The graph the site loads, assembled the way `parseGraph` assembles it. */
export function siteGraph(segments: SiteSegment[]): SiteGraph {
  return {
    segments: new Map(segments.map((segment) => [segment.id, segment])),
    adjacency: buildAdjacency(segments),
    bounds: boundsOf(segments.flatMap((segment) => segment.points)),
  };
}
