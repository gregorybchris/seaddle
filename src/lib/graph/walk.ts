/**
 * An order to visit every segment in, that follows the roads.
 *
 * Reviewing is done one segment at a time, and the cost of the order they
 * arrive in is paid in attention: judging how protected a road is means
 * knowing which road it is, and by id that means re-orienting on the map
 * roughly every second segment, because ids record the order segments were
 * cut, not where they are.
 *
 * Measured over the 158 segments here, by id the median step turns 41 degrees
 * and 30 of the 61 discontinuities cross more than 3 km of city. The walk
 * below turns 23 degrees and leaves 7.
 *
 * Two rules produce that, and the second is the one that is easy to leave out:
 *
 * 1. At a junction, carry straight on. A plain depth-first search takes
 *    whichever segment it happens to hold first, which on a graph with 76
 *    junctions against 6 dead ends means turning off the road at nearly every
 *    opportunity. Choosing the smallest change of heading is what makes a run
 *    feel like riding rather than teleporting.
 *
 * 2. When the road ends, restart at the nearest unvisited segment rather than
 *    unwinding a stack. Going straight strands the turnings behind you, so the
 *    top of a depth-first stack is reliably across town — that variant halves
 *    the turn angle but doubles the distance jumped. Restarting at whatever is
 *    closest keeps both: more breaks, but a typical one is 1.1 km, which is
 *    the next road over rather than another suburb.
 *
 * The order depends only on topology and geometry, so it does not shift while
 * attributes are being entered. Adding or deleting a segment re-walks it.
 */
import { flat, haversineMeters, toLocalMeters } from "@/lib/geo/distance";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { NodeId, SegmentId } from "@/lib/models/graph";
import { buildAdjacency, otherEnd, type Edge } from "./adjacency";

/** A segment with enough geometry to tell which way it leaves a junction. */
export type WalkSegment = Edge & { points: (Coord | ElevCoord)[] };

/**
 * How far along a segment to look when deciding which way it heads.
 *
 * The first vertex pair alone is noise — geometry is resampled to 15 m and a
 * junction sits at whatever angle the source ride happened to cross it. Far
 * enough to be past that, short enough that a curve away later does not count
 * against a road that genuinely does continue straight.
 */
const HEADING_SPAN_METERS = 40;

export function walkOrder(segments: WalkSegment[]): SegmentId[] {
  if (segments.length === 0) return [];

  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const adjacency = buildAdjacency(segments);
  const nodeAt = nodeCoords(segments);

  const visited = new Set<SegmentId>();
  const order: SegmentId[] = [];

  let node = firstNode(segments, adjacency);
  let arrivedOn: SegmentId | null = null;

  while (visited.size < segments.length) {
    const ahead = (adjacency.get(node) ?? []).filter((id) => !visited.has(id));

    let next: SegmentId;
    if (ahead.length > 0) {
      next =
        arrivedOn === null
          ? ahead.reduce((a, b) => (a < b ? a : b))
          : straightestFrom(ahead, node, arrivedOn, byId);
    } else {
      /** Road over. Start again wherever is closest, facing nothing. */
      const restart = nearestUnvisited(segments, visited, nodeAt.get(node));
      next = restart.id;
      node = restart.node;
      arrivedOn = null;
    }

    visited.add(next);
    order.push(next);
    node = otherEnd(byId.get(next)!, node);
    arrivedOn = next;
  }

  return order;
}

/**
 * Where to begin: a dead end if the graph has one.
 *
 * Starting in the middle of a road costs a break that starting at its end does
 * not — the half behind you has to be come back for.
 */
function firstNode(
  segments: WalkSegment[],
  adjacency: Map<NodeId, SegmentId[]>,
): NodeId {
  const nodes = [...adjacency.keys()].sort();
  return (
    nodes.find((node) => (adjacency.get(node) ?? []).length === 1) ??
    nodes[0] ??
    segments[0].from
  );
}

/** One coordinate per node, taken from the end of any segment that meets it. */
function nodeCoords(segments: WalkSegment[]): Map<NodeId, Coord> {
  const at = new Map<NodeId, Coord>();
  for (const segment of segments) {
    if (segment.points.length === 0) continue;
    if (!at.has(segment.from)) at.set(segment.from, flat(segment.points[0]));
    if (!at.has(segment.to)) {
      at.set(segment.to, flat(segment.points[segment.points.length - 1]));
    }
  }
  return at;
}

/**
 * The continuation that changes heading least. Ties break by id, so the same
 * graph always walks the same way.
 */
function straightestFrom(
  options: SegmentId[],
  node: NodeId,
  arrivedOn: SegmentId,
  byId: Map<SegmentId, WalkSegment>,
): SegmentId {
  const incoming = headingAwayFrom(byId.get(arrivedOn)!, node);
  if (incoming === null) return options.reduce((a, b) => (a < b ? a : b));
  /** We left `node` along that segment to arrive, so we are facing back down it. */
  const facing = (incoming + 180) % 360;

  let best = options[0];
  let bestTurn = Infinity;
  for (const id of options) {
    const heading = headingAwayFrom(byId.get(id)!, node);
    const change = heading === null ? 180 : turnBetween(facing, heading);
    if (change < bestTurn || (change === bestTurn && id < best)) {
      best = id;
      bestTurn = change;
    }
  }
  return best;
}

/**
 * Compass heading a segment sets off on, leaving the given end of it.
 *
 * Null when the segment has no geometry loaded yet, which the caller treats as
 * "no idea" rather than as any particular direction.
 */
function headingAwayFrom(segment: WalkSegment, node: NodeId): number | null {
  const points =
    segment.from === node ? segment.points : [...segment.points].reverse();
  if (points.length < 2) return null;

  const origin = flat(points[0]);
  let covered = 0;
  for (let i = 1; i < points.length; i++) {
    covered += haversineMeters(flat(points[i - 1]), flat(points[i]));
    if (covered >= HEADING_SPAN_METERS)
      return headingTo(origin, flat(points[i]));
  }
  return headingTo(origin, flat(points[points.length - 1]));
}

/** Degrees clockwise from north, on the local plane. */
function headingTo(from: Coord, to: Coord): number {
  const { x, y } = toLocalMeters(to, from);
  return (Math.atan2(x, y) * (180 / Math.PI) + 360) % 360;
}

/** How far apart two headings are, never more than a half turn. */
function turnBetween(a: number, b: number): number {
  const apart = Math.abs(a - b) % 360;
  return apart > 180 ? 360 - apart : apart;
}

/** The unvisited segment with an end closest to here, and the end to stand on. */
function nearestUnvisited(
  segments: WalkSegment[],
  visited: Set<SegmentId>,
  here: Coord | undefined,
): { id: SegmentId; node: NodeId } {
  let best: { id: SegmentId; node: NodeId } | null = null;
  let bestMeters = Infinity;

  for (const segment of segments) {
    if (visited.has(segment.id)) continue;
    /** Without a position to measure from, id order is the only stable answer. */
    if (!here || segment.points.length === 0) {
      if (!best || segment.id < best.id)
        best = { id: segment.id, node: segment.from };
      continue;
    }
    const ends: [Coord, NodeId][] = [
      [flat(segment.points[0]), segment.from],
      [flat(segment.points[segment.points.length - 1]), segment.to],
    ];
    for (const [coord, node] of ends) {
      const meters = haversineMeters(here, coord);
      if (
        meters < bestMeters ||
        (meters === bestMeters && best && segment.id < best.id)
      ) {
        best = { id: segment.id, node };
        bestMeters = meters;
      }
    }
  }

  return best!;
}
