import { haversineMeters } from "@/lib/geo/distance";
import { snapEnds } from "@/lib/geo/polyline";
import { roundCoord, roundPoint, simplify } from "@/lib/geo/simplify";
import { nextId } from "@/lib/db/ids";
import { SpatialIndex } from "@/lib/mapping/spatial-index";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { GraphFile, GraphNode, SegmentRecord } from "@/lib/models/graph";
import { SEGMENT_DEFAULTS } from "@/lib/models/graph";
import type { Track } from "@/lib/models/track";
import type { Candidate, TrackPointRef } from "./candidate-finder";

/** Costs under 1% of the length on every real ride, drawn or recorded. */
export const SIMPLIFY_TOLERANCE_METERS = 6;

/** Click within this of an existing junction and you meant that junction. */
export const NODE_SNAP_METERS = 15;

/** How far a click may be from a track and still be pulled onto it. */
export const TRACK_SNAP_METERS = 20;

/**
 * The geometry a segment ships with: cropped, thinned, rounded, and pinned to
 * its junctions.
 *
 * Snapping happens last, after rounding, so the endpoints match the node
 * coordinates exactly rather than to within half a rounding step. Segments that
 * meet at a junction have to share a point precisely or the map draws a
 * hairline gap at every intersection.
 */
export function extractGeometry(
  candidate: Candidate,
  from: Coord,
  to: Coord,
  toleranceMeters = SIMPLIFY_TOLERANCE_METERS,
): ElevCoord[] {
  const thinned = simplify(candidate.points, toleranceMeters).map(roundPoint);
  return snapEnds(thinned, from, to);
}

export function snapToNodes(
  nodes: GraphNode[],
  coord: Coord,
  radiusMeters = NODE_SNAP_METERS,
): GraphNode | null {
  let best: { node: GraphNode; distanceMeters: number } | null = null;
  for (const node of nodes) {
    const distanceMeters = haversineMeters(node.coord, coord);
    if (distanceMeters > radiusMeters) continue;
    if (!best || distanceMeters < best.distanceMeters) {
      best = { node, distanceMeters };
    }
  }
  return best?.node ?? null;
}

/**
 * Pull a click onto the nearest track vertex.
 *
 * Nearest vertex rather than nearest position along the line, which is only
 * safe because import bounds vertex spacing at 15 m: the slack is at most half
 * of that, well inside the radius the candidate finder searches, and junctions
 * end up sitting on real points from a real ride. On the raw files this would
 * not hold — the sparsest ones put vertices 156 m apart.
 */
export function snapToTracks(
  index: SpatialIndex<TrackPointRef>,
  tracks: Track[],
  coord: Coord,
  radiusMeters = TRACK_SNAP_METERS,
): { coord: Coord; track: string; index: number } | null {
  const hit = index.nearest(coord, radiusMeters);
  if (!hit) return null;
  const track = tracks.find((t) => t.slug === hit.item.track);
  if (!track) return null;
  const point = track.points[hit.item.index];
  return {
    coord: [point[0], point[1]],
    track: hit.item.track,
    index: hit.item.index,
  };
}

export type PlacedNode = {
  graph: GraphFile;
  node: GraphNode;
  /** True when the click landed on a junction that already existed. */
  reused: boolean;
  /** False when nothing was close enough to snap to — no segment can reach it. */
  onTrack: boolean;
};

/**
 * Place a junction, reusing one that is already there.
 *
 * Reuse is what makes the graph connect. Two clicks at the same intersection
 * have to produce one node, or the segments either side of it never meet and
 * the route builder sees a dead end where a crossing should be.
 */
export function placeNode(
  graph: GraphFile,
  index: SpatialIndex<TrackPointRef>,
  tracks: Track[],
  coord: Coord,
): PlacedNode {
  const existing = snapToNodes(graph.nodes, coord);
  if (existing) {
    return { graph, node: existing, reused: true, onTrack: true };
  }

  const snapped = snapToTracks(index, tracks, coord);
  const node: GraphNode = {
    id: nextId(
      "n",
      graph.nodes.map((n) => n.id),
    ),
    name: null,
    coord: roundCoord(snapped?.coord ?? coord),
  };
  return {
    graph: { ...graph, nodes: [...graph.nodes, node] },
    node,
    reused: false,
    onTrack: snapped !== null,
  };
}

export type AddedSegment = {
  graph: GraphFile;
  segment: SegmentRecord;
  geometry: ElevCoord[];
};

/**
 * Turn a chosen candidate into a stored segment.
 *
 * Attributes come in defaulted and unreviewed on purpose: extraction should be
 * fast, and deciding whether a road is pleasant is a separate pass.
 */
export function addSegment(
  graph: GraphFile,
  candidate: Candidate,
  from: GraphNode,
  to: GraphNode,
): AddedSegment {
  const segment: SegmentRecord = {
    // Identity first: this is the order the key lands in the file, and `id`
    // buried under six attributes makes a diff hard to read.
    id: nextId(
      "s",
      graph.segments.map((s) => s.id),
    ),
    from: from.id,
    to: to.id,
    source: {
      track: candidate.track,
      startIndex: candidate.startIndex,
      endIndex: candidate.endIndex,
    },
    ...SEGMENT_DEFAULTS,
  };
  return {
    graph: { ...graph, segments: [...graph.segments, segment] },
    segment,
    geometry: extractGeometry(candidate, from.coord, to.coord),
  };
}

/** Remove a segment, and any junction that was only there to hold it up. */
export function removeSegment(graph: GraphFile, id: string): GraphFile {
  const segments = graph.segments.filter((s) => s.id !== id);
  const stillUsed = new Set(segments.flatMap((s) => [s.from, s.to]));
  return {
    ...graph,
    segments,
    nodes: graph.nodes.filter((n) => stillUsed.has(n.id) || isNamed(n)),
    pins: graph.pins.filter((p) => p.segment !== id),
  };
}

/** A named junction was deliberate, so it outlives the segments that used it. */
function isNamed(node: GraphNode): boolean {
  return node.name !== null && node.name.trim() !== "";
}
