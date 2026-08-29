import { haversineMeters } from "@/lib/geo/distance";
import { snapEnds } from "@/lib/geo/polyline";
import { roundCoord, roundPoint, simplify } from "@/lib/geo/simplify";
import { nextId } from "@/lib/db/ids";
import { SpatialIndex } from "@/lib/mapping/spatial-index";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type {
  GraphFile,
  GraphNode,
  NodeId,
  SegmentId,
  SegmentRecord,
} from "@/lib/models/graph";
import { SEGMENT_DEFAULTS } from "@/lib/models/graph";
import type { Track } from "@/lib/models/track";
import type { Candidate, TrackPointRef } from "./candidate-finder";

/**
 * How far the drawn line may stray from the recorded one.
 *
 * A meter, because that is comfortably finer than the source data is accurate —
 * GPS is good to a few meters and a drawn route is only as true as the hand
 * that drew it — while still discarding the vertices import interpolated onto
 * straight runs. Six meters was the first choice and it was wrong: it was
 * validated on total length, which barely moves when corners are cut, and it
 * turned curves into three-line polygons.
 */
export const SIMPLIFY_TOLERANCE_METERS = 1;

/** Click within this of an existing junction and you meant that junction. */
export const NODE_SNAP_METERS = 15;

/** How far a click may be from a track and still be pulled onto it. */
export const TRACK_SNAP_METERS = 20;

/**
 * The geometry a segment ships with: cropped, pinned to its junctions, thinned
 * and rounded.
 *
 * Segments meeting at a junction have to share a point exactly or the map draws
 * a hairline gap at every intersection, so the ends are pinned twice: once
 * before thinning and once after rounding. The first pin is what keeps the line
 * honest — a junction can sit a good twenty meters from where the chosen ride
 * actually passes, and a simplifier that has not been told the line starts
 * there will run a straight chord out to its first kept point and miss the real
 * path by far more than the tolerance. The second pin costs nothing and makes
 * the exact match unconditional rather than a consequence of rounding node
 * coordinates and track points to the same number of places.
 */
export function extractGeometry(
  candidate: Candidate,
  from: Coord,
  to: Coord,
  toleranceMeters = SIMPLIFY_TOLERANCE_METERS,
): ElevCoord[] {
  return buildGeometry(candidate.points, from, to, toleranceMeters);
}

/**
 * The same treatment, applied to any cropped path.
 *
 * Separate from `extractGeometry` so geometry can be rebuilt from a segment's
 * recorded source indices without inventing a candidate around it — which is
 * what makes the tolerance a decision that can be revisited rather than baked
 * into whatever was on disk the day a segment was cut.
 */
export function buildGeometry(
  points: ElevCoord[],
  from: Coord,
  to: Coord,
  toleranceMeters = SIMPLIFY_TOLERANCE_METERS,
): ElevCoord[] {
  const pinned = snapEnds(points, from, to);
  const thinned = simplify(pinned, toleranceMeters).map(roundPoint);
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
 * fast, and deciding whether a segment is pleasant is a separate pass.
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

/**
 * Set or clear an admin label.
 *
 * Blank and whitespace collapse to null so "no name" has exactly one
 * representation, rather than an empty string that sorts and compares
 * differently from the absent case.
 */
export function renameSegment(
  graph: GraphFile,
  id: SegmentId,
  name: string,
): GraphFile {
  const trimmed = name.trim();
  return {
    ...graph,
    segments: graph.segments.map((segment) =>
      segment.id === id ? { ...segment, name: trimmed || null } : segment,
    ),
  };
}

export function renameNode(
  graph: GraphFile,
  id: NodeId,
  name: string,
): GraphFile {
  const trimmed = name.trim();
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === id ? { ...node, name: trimmed || null } : node,
    ),
  };
}

export type NodeRemoval = {
  graph: GraphFile;
  /** Segments still attached. Non-empty means nothing was removed. */
  blockedBy: SegmentId[];
};

/**
 * Remove a junction, unless segments are still hanging off it.
 *
 * Refusing rather than cascading: deleting a junction under a segment would
 * leave geometry pointing at nothing, and quietly taking the segments with it
 * destroys more than the click asked for. The caller gets the list so it can
 * say which ones are in the way.
 */
export function removeNode(graph: GraphFile, id: NodeId): NodeRemoval {
  const blockedBy = graph.segments
    .filter((segment) => segment.from === id || segment.to === id)
    .map((segment) => segment.id);
  if (blockedBy.length > 0) return { graph, blockedBy };
  return {
    graph: { ...graph, nodes: graph.nodes.filter((node) => node.id !== id) },
    blockedBy: [],
  };
}

/**
 * Fold one junction into another.
 *
 * For the crossings auto-snapping cannot see: a bridge deck where two rides
 * pass ten meters apart and never meet, or a trail that resumes across a gap.
 * Everything hanging off the junction being dropped moves to the one being
 * kept, and the caller re-pins the geometry of those segments — without that
 * they would still end where the old junction was and draw a gap at the very
 * crossing this was meant to close.
 */
export function mergeNodes(
  graph: GraphFile,
  keep: NodeId,
  drop: NodeId,
): { graph: GraphFile; moved: SegmentId[] } {
  if (keep === drop) return { graph, moved: [] };

  const moved = graph.segments
    .filter((segment) => segment.from === drop || segment.to === drop)
    .map((segment) => segment.id);

  return {
    graph: {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== drop),
      segments: graph.segments.map((segment) =>
        segment.from === drop || segment.to === drop
          ? {
              ...segment,
              from: segment.from === drop ? keep : segment.from,
              to: segment.to === drop ? keep : segment.to,
            }
          : segment,
      ),
    },
    moved,
  };
}

/**
 * Remove a segment and the pins that lived on it. Junctions are left alone.
 *
 * Every junction was placed deliberately, at a crossing someone found and
 * clicked, and it is the expensive half of the work. Deleting a segment is
 * usually the first half of re-cutting it with better geometry, so taking its
 * junctions along would destroy exactly what the next step needs. Junctions are
 * removed on their own terms, by `removeNode`.
 */
export function removeSegment(graph: GraphFile, id: SegmentId): GraphFile {
  return {
    ...graph,
    segments: graph.segments.filter((segment) => segment.id !== id),
    pins: graph.pins.filter((pin) => pin.segment !== id),
  };
}
