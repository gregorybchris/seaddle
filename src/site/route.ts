import { boundsOf } from "@/lib/geo/bounds";
import { coordAtFraction } from "@/lib/geo/polyline";
import { continuationsFrom, otherEnd } from "@/lib/graph/adjacency";
import { pathTo, reachFrom, type Reach } from "@/lib/graph/paths";
import type { Bounds, Coord, ElevCoord } from "@/lib/models/geo";
import type { NodeId, SegmentId } from "@/lib/models/graph";
import type { SiteGraph, SiteSegment } from "./graph-data";

/** One segment, oriented the way it is ridden. */
export type Step = {
  segment: SegmentId;
  from: NodeId;
  to: NodeId;
  /**
   * Ridden through on the way to something, rather than picked.
   *
   * What fills steps in is the way to a segment picked from further off. That
   * is not a decision, so it is not written into a link — it comes back on its
   * own when the decisions are replayed.
   *
   * Recorded rather than worked out later, because whether a segment was a
   * choice depends on the state of the route when it was added, not on the
   * shape of the graph now.
   */
  auto: boolean;
  /**
   * The step that turned the route around.
   *
   * Riding back down the segment you arrived on is the one thing `append`
   * refuses, so a link cannot describe an out-and-back as another segment — it
   * has to say "and back", and this is what remembers that it did.
   *
   * Only ever set by `outAndBack`, which only a link can currently reach — see
   * the note there.
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
 * The arms of the junction the route is standing at.
 *
 * Not what may be clicked — every segment on the map may be clicked, and
 * anything further off is reached by `append` filling in the way there. This is
 * the smaller question of what leads directly on from here, which is what the
 * camera frames after a pick, what the panel counts, and what the spoken list
 * reads out.
 *
 * With nothing started, that is everything. Otherwise it is whatever touches a
 * live end, minus the segment already occupying it.
 */
export function continuations(route: Route, graph: SiteGraph): Set<SegmentId> {
  if (isEmpty(route)) return new Set(graph.segments.keys());

  const first = route.steps[0];
  const last = route.steps[route.steps.length - 1];

  const next = new Set(
    continuationsFrom(graph.adjacency, last.to, last.segment),
  );
  if (route.ambiguous) {
    for (const id of continuationsFrom(
      graph.adjacency,
      first.from,
      first.segment,
    )) {
      next.add(id);
    }
  }
  return next;
}

/**
 * Add a segment, riding whatever it takes to get to it.
 *
 * Neighbours only, once: a rider who could see the far side of the lake had to
 * zoom in and click their way there one short segment at a time, and the broad
 * strokes they actually had in mind were the one thing they could not pick. So
 * a segment anywhere is a legal pick, and the shortest way to it fills itself
 * in — the rider says where, the graph works out how.
 *
 * Which end of the picked segment gets ridden into is whichever is nearer
 * through the network, so picking a line on the map means the same thing as
 * pointing at it: take me along that. A dead heat goes to the lower node id,
 * because the answer has to survive being replayed out of a link, where the
 * click that asked for it is long gone.
 *
 * Nothing is refused except a segment on an island the route cannot reach at
 * all. Riding back over your own wheel tracks is allowed and always was — a
 * route is a walk through the graph, not a simple path, which is the whole of
 * why out-and-backs work — and a rider who picks a segment behind them has said
 * plainly enough that they want to turn round.
 *
 * Attaching to the far end of an undecided single segment flips that segment
 * rather than refusing: picking the neighbor behind you means you meant to ride
 * the other way, not that you made a mistake.
 */
export function append(
  route: Route,
  segment: SiteSegment,
  graph: SiteGraph,
): Route {
  if (isEmpty(route)) return startRoute(segment);

  const reach = reachFrom(graph.adjacency, graph.segments, liveEnds(route));
  const arrival = nearerEnd(reach, segment);
  if (arrival === null) return route;

  const way = pathTo(reach, arrival);
  const first = route.steps[0];
  // Where the way there set off from, which for a segment already touching the
  // route is the end it touches.
  const source = way.length > 0 ? way[0].from : arrival;

  const opening =
    route.ambiguous && source === first.from
      ? [
          {
            segment: first.segment,
            from: first.to,
            to: first.from,
            auto: false,
          },
        ]
      : route.steps;

  return {
    steps: [
      ...opening,
      ...way.map((leg) => ({ ...leg, auto: true })),
      orient(segment, arrival),
    ],
    ambiguous: false,
  };
}

/**
 * The end of a segment the route can get to soonest, or null for one it cannot
 * get to at all.
 */
function nearerEnd(reach: Reach, segment: SiteSegment): NodeId | null {
  const here = reach.metersTo.get(segment.from);
  const there = reach.metersTo.get(segment.to);
  if (here === undefined) return there === undefined ? null : segment.to;
  if (there === undefined) return segment.from;
  if (here !== there) return here < there ? segment.from : segment.to;
  return segment.from < segment.to ? segment.from : segment.to;
}

/**
 * Every segment a pick could still reach, which is everything until a route
 * starts.
 *
 * The one thing left that the map has to draw as out of play. A ride imported
 * from somewhere nothing else reaches arrives as an island, and once a route is
 * under way there are then segments no amount of riding joins it to — a rider
 * who taps one is owed that answer rather than silence. Nothing is currently
 * on one: the ferry to Bainbridge closed the last gap in the network.
 */
export function reachable(route: Route, graph: SiteGraph): Set<SegmentId> {
  if (isEmpty(route)) return new Set(graph.segments.keys());

  const reach = reachFrom(graph.adjacency, graph.segments, liveEnds(route));
  const open = new Set<SegmentId>();
  for (const segment of graph.segments.values()) {
    if (reach.metersTo.has(segment.from) || reach.metersTo.has(segment.to)) {
      open.add(segment.id);
    }
  }
  return open;
}

/**
 * What a pick would add, for the map to show before it is one.
 *
 * A pick can now be worth a dozen segments, and a map that only reveals that
 * afterwards is asking to be undone. Defined as what the route would gain
 * rather than worked out separately, so it cannot drift from what the pick
 * actually does — the way there included.
 *
 * The first pick answers the same way, with the one segment it would start
 * from. It says nothing the cursor does not, which was the argument for leaving
 * it out — but the mark a hover puts on the map has to mean one thing, and a
 * rider who has learned that the ghost is what they are about to get should not
 * find it missing on the only pick they have not made yet.
 */
export function previewOf(
  route: Route,
  segment: SiteSegment,
  graph: SiteGraph,
): SegmentId[] {
  const next = append(route, segment, graph);
  if (next === route) return [];
  return next.steps.slice(route.steps.length).map((step) => step.segment);
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
 * **Nothing in the site calls this.** There is no out-and-back control on the
 * panel or the map, and `append` cannot produce a turn step — the only way in
 * is `replay` meeting a `t` or `~` in a link. It is kept because those links
 * exist: routes written before the control went away are in bookmarks and in
 * the saved list in people's browsers, and a stored route that decoded to half
 * of itself would be worse than one this cannot be asked for any more. Bringing
 * the gesture back is a button away, and everything under it still works.
 *
 * Nothing else needs to know about it: mirroring the chain is just more steps,
 * so the distance, the climb and the profile all come out right without a
 * special case. The climb does change — a descent ridden home is a climb — and
 * because each mirrored step is oriented the other way, that falls out too.
 *
 * The turn itself counts as the decision, so Undo takes the whole return
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
 * How a link is spelled: bare numbers, hyphens between them.
 *
 * Both of these are chosen for the address bar rather than for the parser. A
 * query string is written in form encoding, which leaves alone exactly the
 * letters, the digits, and `*-._` — so the comma this used to join on arrived
 * as `%2C` and the tilde below as `%7E`, and the one thing a rider is meant to
 * copy and send read like a mistake. A hyphen survives, and dropping the `s`
 * and the padding makes the link shorter than the format that kept them:
 * `17-42-43-88` against `s017,s042,s043,s088`.
 *
 * The turn is a letter for the same reason. It is not a segment, and every
 * other token is a number, so there is nothing for it to be confused with.
 */
const SEPARATOR = "-";
const TURN = "t";

/**
 * The spellings a link may arrive in, which is more than the one it leaves in.
 *
 * Links outlive their formats. Routes written `s017,s042` with `~` for the turn
 * are in bookmarks, in messages, and in the saved list in people's browsers,
 * and a prettier URL is not worth losing one to. Reading both costs a character
 * class and a `replace`; every link is written back out in the current spelling
 * the moment it is opened.
 */
const TOKENS = /[-,]/;
const TURNS = ["t", "~"];

/** `s042` as a link spells it. */
export function encodeSegmentId(id: SegmentId): string {
  return String(Number(id.replace(/^s/, "")));
}

/**
 * A link's spelling of a segment back into the id the graph knows it by.
 *
 * Null for anything that is not one, rather than an id built out of nonsense —
 * a hand-trimmed URL should give back a shorter route, never a different one.
 */
export function decodeSegmentId(token: string): SegmentId | null {
  const digits = token.replace(/^s/, "");
  return /^\d+$/.test(digits) ? `s${digits.padStart(3, "0")}` : null;
}

/**
 * The same link in the current spelling, whatever spelling it arrived in.
 *
 * Only used on the saved list, where the routes are strings that were written
 * down before the format changed — and where two spellings of one route would
 * otherwise stop `save` from recognising it as one it already has.
 */
export function respell(encoded: string): string {
  return encoded
    .split(TOKENS)
    .filter(Boolean)
    .map((token) => {
      if (TURNS.includes(token)) return TURN;
      const id = decodeSegmentId(token);
      return id ? encodeSegmentId(id) : null;
    })
    .filter((token) => token !== null)
    .join(SEPARATOR);
}

/**
 * The route as the decisions that made it, which is all a link has to carry.
 *
 * Only what was chosen: the way filled in to each pick comes back on its own
 * when the choices are replayed, so storing it would be storing something the
 * graph already knows.
 */
export function encodeRoute(route: Route): string {
  return route.steps
    .filter((step) => !step.auto)
    .map((step) => (step.turn ? TURN : encodeSegmentId(step.segment)))
    .join(SEPARATOR);
}

/**
 * Rebuild a route from the choices in a link.
 *
 * Replayed through the same append that a rider's clicks go through, so a
 * shared route is put together by exactly the rules that built it — including
 * the way filled in to each segment picked from further off. Anything that no
 * longer fits is dropped rather than throwing: segments get recut, and a stale
 * link should give back as much of the route as still exists.
 */
export function decodeRoute(encoded: string, graph: SiteGraph): Route {
  const stages = decodeStages(encoded, graph);
  return stages[stages.length - 1];
}

/**
 * Every route the link passed through on the way to the one it names.
 *
 * A list of decisions is also a history, so replaying it a token at a time says
 * what the route was after each of them. That is what lets Undo work on a route
 * that arrived from a link or the saved list: it was built out of decisions
 * like any other, just not in this browser, and they are all still here.
 *
 * Starts at the empty route, so the first decision can be taken back too, and
 * drops tokens that changed nothing — a segment a recut has since removed
 * should not leave behind a step that undoes nothing.
 */
export function decodeStages(encoded: string, graph: SiteGraph): Route[] {
  const stages: Route[] = [EMPTY_ROUTE];
  for (const token of encoded.split(TOKENS).filter(Boolean)) {
    const current = stages[stages.length - 1];
    const next = replay(current, token, graph);
    if (next !== current) stages.push(next);
  }
  return stages;
}

/** One token of a link, applied by the same rules a rider's click goes through. */
function replay(route: Route, token: string, graph: SiteGraph): Route {
  if (TURNS.includes(token)) return outAndBack(route);
  const id = decodeSegmentId(token);
  const segment = id ? graph.segments.get(id) : undefined;
  if (!segment) return route;
  return isEmpty(route) ? startRoute(segment) : append(route, segment, graph);
}

/**
 * Each step beside the segment it names.
 *
 * One place resolves a step against the graph, and one place decides what to do
 * about a step the graph no longer has — it is dropped, because a link outlives
 * the segments it was cut from and half a remembered route beats an exception.
 */
function ridden(
  route: Route,
  graph: SiteGraph,
): { step: Step; segment: SiteSegment }[] {
  return route.steps.flatMap((step) => {
    const segment = graph.segments.get(step.segment);
    return segment ? [{ step, segment }] : [];
  });
}

/** The segments of the route, in the order they are taken. */
export function routeSegments(route: Route, graph: SiteGraph): SiteSegment[] {
  return ridden(route, graph).map(({ segment }) => segment);
}

/**
 * Which way round each segment is ridden, for anything laid out along the
 * route.
 *
 * A segment is stored one way and can be taken either, so anything placed at a
 * fraction along it — a pin, a marker — needs to be told which end that
 * fraction counts from.
 */
export function riddenOrder(
  route: Route,
  graph: SiteGraph,
): { segment: SegmentId; reversed: boolean }[] {
  return ridden(route, graph).map(({ step, segment }) => ({
    segment: segment.id,
    reversed: step.from !== segment.from,
  }));
}

/**
 * How far the route is ridden.
 *
 * A crossing is not in it. The ferry to Bainbridge is eight miles of line on
 * the map and not one of them is pedalled, so a rider told they have
 * twenty-two miles ahead of them when fourteen are under their own legs has
 * been told the wrong thing — and the whole point of the numbers on this site
 * is that a beginner can trust them. The crossings are reported beside this
 * instead, by `routeCrossings`, where they can say what they are.
 */
export function routeMeters(route: Route, graph: SiteGraph): number {
  return ridden(route, graph).reduce(
    (total, { segment }) => total + (segment.crossing ? 0 : segment.meters),
    0,
  );
}

/**
 * The crossings the route takes, in the order they are taken.
 *
 * Listed rather than counted, because a rider needs to know *which* boat: the
 * one line the panel has room for is worth more spent on "ferry to Bainbridge"
 * than on "1 crossing". Repeats are kept — an out-and-back rides the ferry
 * twice, and both are journeys to be caught.
 */
export function routeCrossings(route: Route, graph: SiteGraph): SiteSegment[] {
  return ridden(route, graph)
    .map(({ segment }) => segment)
    .filter((segment) => segment.crossing !== null);
}

/** Climbing in the direction each segment is actually being ridden. */
function stepGain(step: Step, segment: SiteSegment): number {
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
  const total = ridden(route, graph).reduce(
    (sum, { step, segment }) => sum + stepGain(step, segment),
    0,
  );
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
  return routeLine(route, graph).points;
}

/**
 * The assembled line, and which of its legs are crossed rather than ridden.
 *
 * One walk answers both, because they are the same walk: `crossed` holds the
 * index of every point whose leg back from the point before it belongs to a
 * crossing. Handed to `cumulativeMeters` and the things built on it, those legs
 * measure zero — so the elevation chart runs from the Seattle shore straight on
 * to the Bainbridge one, the scrub under a finger stays on the road it is
 * pointing at, and the length of the chart is the distance on the panel.
 *
 * The points themselves stay in. The map still has to draw the crossing, the
 * camera still has to frame it, and a route whose two halves are eight miles
 * apart has to know that about itself.
 */
export function routeLine(
  route: Route,
  graph: SiteGraph,
): { points: ElevCoord[]; crossed: Set<number> } {
  const points: ElevCoord[] = [];
  const crossed = new Set<number>();
  for (const { step, segment } of ridden(route, graph)) {
    const ordered =
      step.from === segment.from
        ? segment.points
        : [...segment.points].reverse();
    const added = points.length === 0 ? ordered : ordered.slice(1);
    if (segment.crossing) {
      // Every leg of it, including the one joining it to the segment before —
      // that join is the same water.
      const first = Math.max(1, points.length);
      for (let i = first; i < points.length + added.length; i++) crossed.add(i);
    }
    points.push(...added);
  }
  return { points, crossed };
}

/**
 * The route cut into the stretches that are ridden, dropping the crossings.
 *
 * What a GPX has to say: a file with a straight line drawn eight miles over
 * open water is a file that will happily navigate somebody into Elliott Bay.
 * GPX has a shape for exactly this — one track, one segment per continuous
 * stretch — so the boat becomes the space between two of them.
 */
export function riddenLegs(route: Route, graph: SiteGraph): ElevCoord[][] {
  const { points, crossed } = routeLine(route, graph);
  const legs: ElevCoord[][] = [];
  let leg: ElevCoord[] = [];
  for (let i = 0; i < points.length; i++) {
    if (crossed.has(i)) {
      if (leg.length > 1) legs.push(leg);
      // The next leg starts wherever the boat put the rider down, which is the
      // last point the crossing covers — so each reset carries the point with
      // it and the last one to run wins.
      leg = [points[i]];
      continue;
    }
    leg.push(points[i]);
  }
  if (leg.length > 1) legs.push(leg);
  return legs;
}

/**
 * The area the turnings occupy: the junction the route has arrived at.
 *
 * This, rather than the route so far, is what the map should be showing. The
 * segment already ridden is settled; the decision in front of the rider is
 * which way to go next, and a view framed on twenty miles of history can leave
 * the turnings too small to tell apart.
 *
 * The junction rather than everywhere a pick could now reach, which since
 * `append` learned to fill in the way to a segment is most of the city — and
 * framing all of it would pull the camera back to the network fit on every
 * pick, which is the opposite of following a route being built. Null when the
 * route has not started, or has run out of segment.
 */
export function choiceBounds(route: Route, graph: SiteGraph): Bounds | null {
  if (isEmpty(route)) return null;
  const points = [...continuations(route, graph)].flatMap(
    (id) => graph.segments.get(id)?.points ?? [],
  );
  return points.length > 0 ? boundsOf(points) : null;
}

/**
 * The point the map should hold still while a route grows.
 *
 * The end of the route, because that is where the next choice is and therefore
 * where the cursor already is. An opening segment has no end yet — both of them
 * are live — so it holds its middle instead, which keeps either end reachable.
 */
export function focusAnchor(route: Route, graph: SiteGraph): Coord | null {
  const points = routePoints(route, graph);
  if (points.length === 0) return null;
  if (route.ambiguous) return coordAtFraction(points, 0.5);
  const last = points[points.length - 1];
  return [last[0], last[1]];
}

/**
 * Where the route sets off from, once it is settled where that is.
 *
 * A line on a map has no visible direction, and a route long enough to be worth
 * building is long enough that its two ends are nowhere near each other — so
 * without this the rider has to remember which end they started at. The same
 * green dot the admin and the explore panel use, because it is the same
 * question being answered.
 *
 * Null while the route is a single segment: both ends are still live and which
 * one is the start is exactly what has not been decided. Marking one anyway
 * would be the map picking a direction and presenting it as fact, which is the
 * same lie the climbing range exists to avoid.
 */
export function routeStart(route: Route, graph: SiteGraph): Coord | null {
  if (isEmpty(route) || route.ambiguous) return null;
  return endOf(route.steps[0], graph, "from");
}

/**
 * Where the route has got to, once it is settled which end that is.
 *
 * The checkered flag to the start's green dot, and the same pair the admin and
 * the explore panel use — a rider reading one segment and a rider building out
 * of a dozen are asking the same question of the line, which way does it run,
 * and answering it two ways would be two things to learn instead of one.
 *
 * Null on the same condition as `routeStart`: a single segment has two live
 * ends and no direction to report, so it gets neither mark.
 */
export function routeFinish(route: Route, graph: SiteGraph): Coord | null {
  if (isEmpty(route) || route.ambiguous) return null;
  return endOf(route.steps[route.steps.length - 1], graph, "to");
}

/** The coordinate at one end of a step, taken the way the step is ridden. */
function endOf(
  step: Step,
  graph: SiteGraph,
  which: "from" | "to",
): Coord | null {
  const segment = graph.segments.get(step.segment);
  if (!segment || segment.points.length === 0) return null;
  // A step ridden against the segment's own direction meets each of its ends at
  // the other end of the drawn line.
  const forwards = step[which] === segment[which];
  const head = which === "from" ? forwards : !forwards;
  const point = head
    ? segment.points[0]
    : segment.points[segment.points.length - 1];
  return [point[0], point[1]];
}

/** The whole route, for when it is being looked at rather than built. */
export function routeBounds(route: Route, graph: SiteGraph): Bounds | null {
  const points = routePoints(route, graph);
  return points.length > 0 ? boundsOf(points) : null;
}
