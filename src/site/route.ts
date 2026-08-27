import { boundsOf } from "@/lib/geo/bounds";
import { elevationProfile, type Profile } from "@/lib/geo/profile";
import { otherEnd } from "@/lib/graph/adjacency";
import type { Bounds, ElevCoord } from "@/lib/models/geo";
import type { NodeId, SegmentId } from "@/lib/models/graph";
import type { SiteGraph, SiteSegment } from "./graph-data";

/** One segment, oriented the way it is ridden. */
export type Step = {
  segment: SegmentId;
  from: NodeId;
  to: NodeId;
  /**
   * Added by following the road rather than by being picked.
   *
   * Recorded rather than worked out later, because whether a segment was a
   * choice depends on the state of the route when it was added, not on the
   * shape of the graph now.
   */
  auto: boolean;
  /**
   * The step that turned the route around.
   *
   * Riding back down the road you arrived on is the one thing `append` refuses,
   * so a link cannot describe an out-and-back as another segment — it has to
   * say "and back", and this is what remembers that it did.
   */
  turn?: boolean;
};

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
    steps: [
      { segment: segment.id, from: segment.from, to: segment.to, auto: false },
    ],
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
 *
 * Refuses anything that is not a legal continuation. The rule lives here rather
 * than in each caller, because a version that merely checked whether a segment
 * touched the live end would let a route double straight back down the road it
 * arrived on — which the highlighting says is not allowed.
 */
export function append(
  route: Route,
  segment: SiteSegment,
  graph: SiteGraph,
): Route {
  if (isEmpty(route)) return startRoute(segment);
  if (!canAppend(route, segment, graph)) return route;

  const first = route.steps[0];
  const last = route.steps[route.steps.length - 1];

  if (touches(segment, last.to)) {
    return runOn(
      { steps: [...route.steps, orient(segment, last.to)], ambiguous: false },
      graph,
    );
  }

  if (route.ambiguous && touches(segment, first.from)) {
    const flipped: Step = {
      segment: first.segment,
      from: first.to,
      to: first.from,
      auto: false,
    };
    return runOn(
      { steps: [flipped, orient(segment, first.from)], ambiguous: false },
      graph,
    );
  }

  return route;
}

/**
 * Carry on through junctions that offer nothing to decide.
 *
 * A junction where two segments meet is a bend in the road, not a fork, and
 * asking someone to click through it is asking them to confirm the only thing
 * they could have done. So the route runs on by itself until it reaches
 * somewhere with a real choice, or nowhere left to go.
 *
 * Not done from the opening segment: while both its ends are still live the
 * choice on offer is which way to ride, which is a real one even where each end
 * has a single road leading off it.
 *
 * Stops on a segment already ridden. A ring of two-segment junctions has no
 * fork to arrive at, and without this it would circle forever.
 */
function runOn(route: Route, graph: SiteGraph): Route {
  let current = route;
  const ridden = new Set(current.steps.map((step) => step.segment));

  for (;;) {
    if (current.ambiguous) break;
    const onward = [...continuations(current, graph)];
    if (onward.length !== 1) break;

    const segment = graph.segments.get(onward[0]);
    if (!segment || ridden.has(segment.id)) break;
    ridden.add(segment.id);

    const last = current.steps[current.steps.length - 1];
    current = {
      steps: [...current.steps, { ...orient(segment, last.to), auto: true }],
      ambiguous: false,
    };
  }

  return current;
}

/**
 * Undo one decision, not one segment.
 *
 * Whatever the route ran on through by itself comes off with the choice that
 * caused it — stepping back through a bend the rider never chose would make
 * them press the button twice to undo one click.
 */
export function undo(route: Route): Route {
  const steps = [...route.steps];
  while (steps.length > 0 && steps[steps.length - 1].auto) steps.pop();
  steps.pop();
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
    auto: false,
  };
}

/**
 * Ride back the way you came.
 *
 * Nothing else needs to know about it: mirroring the chain is just more steps,
 * so the distance, the climb and the profile all come out right without a
 * special case. The climb does change — a descent ridden home is a climb — and
 * because each mirrored step is oriented the other way, that falls out too.
 *
 * The turn itself counts as the decision, so Step back takes the whole return
 * leg off in one press rather than unpicking it a segment at a time.
 */
export function outAndBack(route: Route): Route {
  if (isEmpty(route)) return route;
  const mirrored = [...route.steps].reverse().map((step, index) => ({
    segment: step.segment,
    from: step.to,
    to: step.from,
    auto: index > 0,
    ...(index === 0 ? { turn: true } : {}),
  }));
  return { steps: [...route.steps, ...mirrored], ambiguous: false };
}

/**
 * The route as the decisions that made it, which is all a link has to carry.
 *
 * Only what was chosen: everything the route ran through by itself comes back
 * on its own when the choices are replayed, so storing it would be storing
 * something the graph already knows.
 */
export const TURN = "~";

export function encodeRoute(route: Route): string {
  return route.steps
    .filter((step) => !step.auto)
    .map((step) => (step.turn ? TURN : step.segment))
    .join(",");
}

/**
 * Rebuild a route from the choices in a link.
 *
 * Replayed through the same append that a rider's clicks go through, so a
 * shared route is put together by exactly the rules that built it — including
 * running on through junctions with nothing to decide. Anything that no longer
 * fits is dropped rather than throwing: segments get recut, and a stale link
 * should give back as much of the ride as still exists.
 */
export function decodeRoute(encoded: string, graph: SiteGraph): Route {
  let route = EMPTY_ROUTE;
  for (const token of encoded.split(",").filter(Boolean)) {
    if (token === TURN) {
      route = outAndBack(route);
      continue;
    }
    const segment = graph.segments.get(token);
    if (!segment) continue;
    route = isEmpty(route)
      ? startRoute(segment)
      : append(route, segment, graph);
  }
  return route;
}

export type Leg = {
  /** The steps added by one decision: the chosen segment and anything run through after it. */
  steps: Step[];
  meters: number;
  gain: number;
};

/**
 * The route as a list of decisions rather than a list of segments.
 *
 * What a rider chose is a turn, not the three bends that followed it, and Step
 * back takes one of these off — so a list of segments would show three rows
 * disappearing for one press.
 */
export function legs(route: Route, graph: SiteGraph): Leg[] {
  const out: Leg[] = [];
  for (const step of route.steps) {
    const segment = graph.segments.get(step.segment);
    const meters = segment?.meters ?? 0;
    const gain = segment ? stepGain(step, segment) : 0;

    const current = out[out.length - 1];
    if (step.auto && current) {
      current.steps.push(step);
      current.meters += meters;
      current.gain += gain;
    } else {
      out.push({ steps: [step], meters, gain });
    }
  }
  return out;
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

/**
 * The area the choices occupy: every segment the route could grow into.
 *
 * This, rather than the route so far, is what the map should be showing. The
 * road already ridden is settled; the decision in front of the rider is which
 * way to go next, and a view framed on twenty miles of history can leave the
 * turnings too small to tell apart. Null when the route has not started, or has
 * run out of road — in both cases there is nothing to frame.
 */
export function choiceBounds(route: Route, graph: SiteGraph): Bounds | null {
  if (isEmpty(route)) return null;
  const points = [...continuations(route, graph)].flatMap(
    (id) => graph.segments.get(id)?.points ?? [],
  );
  return points.length > 0 ? boundsOf(points) : null;
}

export function routeProfile(route: Route, graph: SiteGraph): Profile {
  return elevationProfile(routePoints(route, graph), 96);
}
