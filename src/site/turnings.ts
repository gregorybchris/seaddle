import { compassPoint, departureHeading } from "@/lib/geo/heading";
import { projectOntoPolyline, reversed } from "@/lib/geo/polyline";
import type { Coord } from "@/lib/models/geo";
import type { NodeId, SegmentId } from "@/lib/models/graph";
import type { SiteGraph, SiteSegment } from "./graph-data";
import { continuations, isEmpty, liveEnds, type Route } from "./route";

/**
 * How many segments to offer before a route has started.
 *
 * With nothing picked every segment in the network is a legal first choice, and
 * a list of a hundred and seventy is not a list anyone reads — it is the map
 * again, worse. Eight is a screenful, and the map moving under the reader is
 * what changes which eight: panning is how you say where you mean, exactly as
 * it is for someone pointing at it.
 */
export const NEARBY = 8;

/**
 * A segment that could be taken next, described from where the rider is
 * standing.
 *
 * The map answers this by being pointed at; this answers it in words, because a
 * segment on a canvas cannot be reached with a keyboard and cannot be read
 * aloud. Everything here is what you would tell someone at a junction: which
 * way it goes, how far, how much of a climb that way, and what it is like.
 *
 * The junction only, where a pick on the map may land anywhere. Reading out a
 * hundred and seventy segments is not reading out a list, and the turn in front
 * of the rider is the decision they are actually at.
 */
export type Turning = {
  segment: SiteSegment;
  /**
   * The compass point you set off in, or null before a route has a direction —
   * where the list is nearest-first rather than a junction being read round.
   */
  heading: ReturnType<typeof compassPoint> | null;
  /** Climbing in the direction it would actually be ridden. */
  climbMeters: number;
};

/** The segment oriented the way it leaves `node`. */
function leaving(segment: SiteSegment, node: NodeId) {
  return segment.from === node ? segment.points : reversed(segment.points);
}

function climbFrom(segment: SiteSegment, node: NodeId): number {
  return segment.from === node ? segment.gainForward : segment.gainBackward;
}

/**
 * The segments on offer right now, in the order they are worth hearing.
 *
 * Once a route is under way that is the junction read clockwise from north, so
 * two segments keep their relative order however the map is moved — a list that
 * reshuffled under a rider's fingers would make the same key mean a different
 * turn each time. Before it starts there is no junction to read round, so the
 * segments nearest the middle of the map come first and `near` is what the
 * reader has panned to.
 */
export function turnings(
  route: Route,
  graph: SiteGraph,
  near: Coord | null,
): Turning[] {
  const open = continuations(route, graph);
  return isEmpty(route)
    ? nearest(open, graph, near)
    : atJunction(route, open, graph);
}

/**
 * The segments closest to the middle of the map, before a route has a
 * direction.
 *
 * Every segment in the network is a legal first pick, so the list is cut to a
 * screenful and panning is how the reader says which screenful they mean.
 */
function nearest(
  open: Set<SegmentId>,
  graph: SiteGraph,
  near: Coord | null,
): Turning[] {
  if (!near) return [];
  return [...open]
    .flatMap((id) => {
      const segment = graph.segments.get(id);
      if (!segment) return [];
      return [
        {
          segment,
          away: projectOntoPolyline(segment.points, near).distanceMeters,
        },
      ];
    })
    .sort((a, b) => a.away - b.away)
    .slice(0, NEARBY)
    .map(({ segment }) => ({
      segment,
      heading: null,
      // No direction settled yet, so the honest figure is the harder of the
      // two — the same one the map's hover label shows.
      climbMeters: Math.max(segment.gainForward, segment.gainBackward),
    }));
}

/** The arms of the junction the rider is standing at, read clockwise from
 *  north. */
function atJunction(
  route: Route,
  open: Set<SegmentId>,
  graph: SiteGraph,
): Turning[] {
  const found = new Map<SegmentId, Turning>();
  for (const node of liveEnds(route)) {
    for (const id of graph.adjacency.get(node) ?? []) {
      if (!open.has(id) || found.has(id)) continue;
      const segment = graph.segments.get(id);
      if (!segment) continue;

      const degrees = departureHeading(leaving(segment, node));
      found.set(id, {
        segment,
        heading: degrees === null ? null : compassPoint(degrees),
        climbMeters: climbFrom(segment, node),
      });
    }
  }

  return [...found.values()].sort(
    (a, b) => order(a.heading) - order(b.heading) || compare(a, b),
  );
}

const ORDER = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

function order(heading: Turning["heading"]): number {
  return heading === null ? ORDER.length : ORDER.indexOf(heading);
}

/** Two segments leaving the same way are settled by id, so the order is
 *  stable. */
function compare(a: Turning, b: Turning): number {
  return a.segment.id.localeCompare(b.segment.id);
}
