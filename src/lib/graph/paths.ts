import type { NodeId, SegmentId } from "@/lib/models/graph";
import { otherEnd, type Adjacency, type Edge } from "./adjacency";

/**
 * A segment with the one number a route is measured in.
 *
 * Distance rather than a comfort score built out of steepness and protection.
 * Both are defensible, and shortest is the one a rider can predict: a fill they
 * did not ask for should be the obvious way there, not the way an unexplained
 * weighting preferred. What the detour would have cost them is on the map in
 * colour anyway.
 */
export type Weighted = Edge & { meters: number };

/**
 * How far every node is, and how you got there.
 *
 * One search answers both questions a click asks — whether the segment can be
 * reached at all, and which way — so they are not worth separating.
 */
export type Reach = {
  /** Metres from the nearest source. Absent for a node no source can reach. */
  metersTo: Map<NodeId, number>;
  /** The segment ridden into each node, and the end it set off from. */
  cameBy: Map<NodeId, { segment: SegmentId; from: NodeId }>;
};

/** One segment of a path, oriented the way it is ridden. */
export type Leg = { segment: SegmentId; from: NodeId; to: NodeId };

/**
 * Shortest distance from any of `sources` to everywhere it can be ridden.
 *
 * Several sources rather than one because a route that is still a single
 * segment can grow from either end, and seeding both at zero lets one search
 * settle which end is nearer instead of running two and comparing.
 *
 * The minimum is found by scanning rather than by a heap. This graph is a
 * hundred-odd nodes, which makes a scan some thousands of comparisons — far
 * below anything a click could notice — and a heap here would be twenty lines
 * of apparatus bought with nothing.
 *
 * Ties are broken deterministically, and that is load-bearing rather than
 * tidiness: a link replays through the same search that built it, so two equally
 * short ways round a block have to resolve the same way in every browser and
 * after every reload, or a shared route comes back as a different one.
 */
export function reachFrom(
  adjacency: Adjacency,
  segments: Map<SegmentId, Weighted>,
  sources: NodeId[],
): Reach {
  const metersTo = new Map<NodeId, number>();
  const cameBy = new Map<NodeId, { segment: SegmentId; from: NodeId }>();
  const settled = new Set<NodeId>();

  for (const source of sources) metersTo.set(source, 0);

  for (;;) {
    let node: NodeId | null = null;
    let best = Infinity;
    for (const [candidate, meters] of metersTo) {
      if (settled.has(candidate)) continue;
      if (
        meters < best ||
        (meters === best && node !== null && candidate < node)
      ) {
        node = candidate;
        best = meters;
      }
    }
    if (node === null) break;
    settled.add(node);

    for (const id of adjacency.get(node) ?? []) {
      const segment = segments.get(id);
      if (!segment) continue;
      const next = otherEnd(segment, node);
      if (settled.has(next)) continue;

      const total = best + segment.meters;
      const known = metersTo.get(next);
      // The segment id settles a dead heat. Two ways round a block of equal
      // length are equally good answers, and the point is only that it is the
      // same one every time.
      const arrival = cameBy.get(next);
      if (
        known === undefined ||
        total < known ||
        (total === known && arrival !== undefined && id < arrival.segment)
      ) {
        metersTo.set(next, total);
        cameBy.set(next, { segment: id, from: node });
      }
    }
  }

  return { metersTo, cameBy };
}

/**
 * The segments ridden from the nearest source to `node`, in riding order.
 *
 * Empty for a source itself — standing somewhere is not a journey to it — and
 * empty for a node the search never reached, which callers separate by asking
 * `metersTo` rather than by the length of this.
 */
export function pathTo(reach: Reach, node: NodeId): Leg[] {
  const legs: Leg[] = [];
  let at = node;
  for (;;) {
    const arrival = reach.cameBy.get(at);
    if (!arrival) break;
    legs.push({ segment: arrival.segment, from: arrival.from, to: at });
    at = arrival.from;
  }
  return legs.reverse();
}
