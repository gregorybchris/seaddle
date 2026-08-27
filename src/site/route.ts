import { elevationProfile, type Profile } from "@/lib/geo/profile";
import { otherEnd } from "@/lib/graph/adjacency";
import type { ElevCoord } from "@/lib/models/geo";
import type { NodeId, SegmentId } from "@/lib/models/graph";
import type { SiteGraph, SiteSegment } from "./graph-data";

/** One segment, oriented the way it is ridden. */
export type Step = { segment: SegmentId; from: NodeId; to: NodeId };

export type Route = {
  steps: Step[];
  /**
   * True while the route is a single segment and could still grow from either
   * end — the direction is not decided until a second segment picks a side.
   */
  ambiguous: boolean;
};

export const EMPTY_ROUTE: Route = { steps: [], ambiguous: false };

export function isEmpty(route: Route): boolean {
  return route.steps.length === 0;
}

export function startRoute(segment: SiteSegment): Route {
  return {
    steps: [{ segment: segment.id, from: segment.from, to: segment.to }],
    ambiguous: true,
  };
}

/**
 * The junctions the route can currently grow from.
 *
 * Two while a single segment is still undecided, one once a second segment has
 * said which way round it is being ridden.
 */
export function liveEnds(route: Route): NodeId[] {
  if (isEmpty(route)) return [];
  const first = route.steps[0];
  const last = route.steps[route.steps.length - 1];
  return route.ambiguous ? [first.from, last.to] : [last.to];
}

/**
 * Segments that may be clicked next.
 *
 * With nothing started, that is everything. Otherwise it is whatever touches a
 * live end, minus the segment already occupying it — which is what stops a
 * route from doubling back on itself in place.
 */
export function continuations(route: Route, graph: SiteGraph): Set<SegmentId> {
  if (isEmpty(route)) return new Set(graph.segments.keys());

  const first = route.steps[0];
  const last = route.steps[route.steps.length - 1];
  const next = new Set<SegmentId>();

  const gather = (node: NodeId, arrivedOn: SegmentId) => {
    for (const id of graph.adjacency.get(node) ?? []) {
      if (id !== arrivedOn) next.add(id);
    }
  };

  gather(last.to, last.segment);
  if (route.ambiguous) gather(first.from, first.segment);
  return next;
}

export function canAppend(
  route: Route,
  segment: SiteSegment,
  graph: SiteGraph,
): boolean {
  return continuations(route, graph).has(segment.id);
}

/**
 * Add a segment to whichever live end it touches.
 *
 * Attaching to the far end of an undecided single segment flips that segment
 * rather than refusing: clicking the neighbour behind you means you meant to
 * ride the other way, not that you made a mistake.
 */
export function append(route: Route, segment: SiteSegment): Route {
  if (isEmpty(route)) return startRoute(segment);

  const first = route.steps[0];
  const last = route.steps[route.steps.length - 1];

  if (touches(segment, last.to)) {
    return {
      steps: [...route.steps, orient(segment, last.to)],
      ambiguous: false,
    };
  }

  if (route.ambiguous && touches(segment, first.from)) {
    const flipped: Step = {
      segment: first.segment,
      from: first.to,
      to: first.from,
    };
    return { steps: [flipped, orient(segment, first.from)], ambiguous: false };
  }

  return route;
}

/** Drop the last segment. Back at one, both ends go live again. */
export function undo(route: Route): Route {
  const steps = route.steps.slice(0, -1);
  return { steps, ambiguous: steps.length === 1 };
}

function touches(segment: SiteSegment, node: NodeId): boolean {
  return segment.from === node || segment.to === node;
}

function orient(segment: SiteSegment, from: NodeId): Step {
  return {
    segment: segment.id,
    from,
    to: otherEnd(segment, from),
  };
}

export function routeMeters(route: Route, graph: SiteGraph): number {
  return route.steps.reduce(
    (total, step) => total + (graph.segments.get(step.segment)?.meters ?? 0),
    0,
  );
}

/** Climbing in the direction each segment is actually being ridden. */
export function stepGain(step: Step, segment: SiteSegment): number {
  return step.from === segment.from
    ? segment.gainForward
    : segment.gainBackward;
}

/**
 * Total climb, or the range it could be.
 *
 * A single segment has not been given a direction yet, and the two answers can
 * differ by hundreds of feet, so both are reported rather than one being picked
 * and quietly presented as fact.
 */
export function routeGain(
  route: Route,
  graph: SiteGraph,
): { min: number; max: number } {
  if (route.ambiguous && route.steps.length === 1) {
    const segment = graph.segments.get(route.steps[0].segment);
    if (!segment) return { min: 0, max: 0 };
    return {
      min: Math.min(segment.gainForward, segment.gainBackward),
      max: Math.max(segment.gainForward, segment.gainBackward),
    };
  }
  const total = route.steps.reduce((sum, step) => {
    const segment = graph.segments.get(step.segment);
    return segment ? sum + stepGain(step, segment) : sum;
  }, 0);
  return { min: total, max: total };
}

/**
 * Every point along the route, in riding order.
 *
 * The junction shared by two segments appears once, not twice — segments meet
 * on an identical coordinate by construction, so the duplicate would sit on top
 * of itself and add a zero-length step to the elevation profile.
 */
export function routePoints(route: Route, graph: SiteGraph): ElevCoord[] {
  const points: ElevCoord[] = [];
  for (const step of route.steps) {
    const segment = graph.segments.get(step.segment);
    if (!segment) continue;
    const ordered =
      step.from === segment.from
        ? segment.points
        : [...segment.points].reverse();
    points.push(...(points.length === 0 ? ordered : ordered.slice(1)));
  }
  return points;
}

export function routeProfile(route: Route, graph: SiteGraph): Profile {
  return elevationProfile(routePoints(route, graph), 96);
}
