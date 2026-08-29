import type { NodeId, SegmentId } from "@/lib/models/graph";

/**
 * The topology of a segment and nothing else.
 *
 * Adjacency has no business knowing what a segment is paved with, and asking
 * for a whole segment record would stop the site — which holds a different
 * shape — from using the same traversal the admin does.
 */
export type Edge = { id: SegmentId; from: NodeId; to: NodeId };

export type Adjacency = Map<NodeId, SegmentId[]>;

/**
 * Which segments touch each node.
 *
 * Derived on load rather than stored. At a few hundred segments this is under a
 * millisecond, and a denormalized index in the file is one more thing that can
 * disagree with the segments it describes.
 */
export function buildAdjacency(segments: Edge[]): Adjacency {
  const adjacency: Adjacency = new Map();
  const add = (node: NodeId, segment: SegmentId) => {
    const existing = adjacency.get(node);
    if (existing) existing.push(segment);
    else adjacency.set(node, [segment]);
  };
  for (const segment of segments) {
    add(segment.from, segment.id);
    if (segment.to !== segment.from) add(segment.to, segment.id);
  }
  return adjacency;
}

/**
 * Segments that continue from a node, excluding the one you arrived on.
 *
 * This is what decides which lines light up as clickable while a route is being
 * built, so it is the difference between a beginner knowing what to do next and
 * guessing.
 */
export function continuationsFrom(
  adjacency: Adjacency,
  node: NodeId,
  arrivedOn: SegmentId | null,
): SegmentId[] {
  return (adjacency.get(node) ?? []).filter((id) => id !== arrivedOn);
}

/** The far end of a segment, given the end you are standing on. */
export function otherEnd(segment: Edge, node: NodeId): NodeId {
  if (segment.from === node) return segment.to;
  if (segment.to === node) return segment.from;
  throw new Error(`Segment ${segment.id} does not touch node ${node}`);
}

/**
 * Islands in the graph, largest first.
 *
 * The source rides cover Everett, Edmonds and Burien as well as Seattle, and
 * those almost certainly never touch the main network. That is a normal
 * condition rather than a bug, but it has to be visible.
 */
export function connectedComponents(segments: Edge[]): NodeId[][] {
  const adjacency = buildAdjacency(segments);
  const byId = new Map(segments.map((s) => [s.id, s]));
  const seen = new Set<NodeId>();
  const components: NodeId[][] = [];

  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    const component: NodeId[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const node = stack.pop()!;
      component.push(node);
      for (const segmentId of adjacency.get(node) ?? []) {
        const next = otherEnd(byId.get(segmentId)!, node);
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    components.push(component);
  }

  return components.sort((a, b) => b.length - a.length);
}
