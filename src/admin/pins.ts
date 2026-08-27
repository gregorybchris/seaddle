import { nextId } from "@/lib/db/ids";
import { projectOntoPolyline } from "@/lib/geo/polyline";
import { roundCoord } from "@/lib/geo/simplify";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type {
  GraphFile,
  Pin,
  PinId,
  PinKind,
  SegmentId,
} from "@/lib/models/graph";

/**
 * Which segment a click meant, and how far along it.
 *
 * A pin belongs to a segment rather than floating on the map, so dropping one
 * is really two questions — which road, and where on it — answered by the same
 * click. Returns nothing when the click is too far from any segment to be
 * about one.
 */
export function pinTarget(
  geometry: Map<SegmentId, ElevCoord[]>,
  coord: Coord,
  withinMeters = 40,
): { segment: SegmentId; at: number; distanceMeters: number } | null {
  let best: { segment: SegmentId; at: number; distanceMeters: number } | null =
    null;
  for (const [segment, points] of geometry) {
    if (points.length < 2) continue;
    const hit = projectOntoPolyline(points, coord);
    if (hit.distanceMeters > withinMeters) continue;
    if (!best || hit.distanceMeters < best.distanceMeters) {
      best = {
        segment,
        at: hit.fraction,
        distanceMeters: hit.distanceMeters,
      };
    }
  }
  return best;
}

/**
 * Put a pin on a segment.
 *
 * Its position is stored twice on purpose: `at` says how far along the road it
 * is, which is what orders it against the rest of a ride, and `coord` says
 * where the thing itself stands — a fountain sits in the park beside the trail,
 * not on the center line.
 */
export function addPin(
  graph: GraphFile,
  segment: SegmentId,
  at: number,
  kind: PinKind,
  coord: Coord,
): { graph: GraphFile; pin: Pin } {
  const pin: Pin = {
    id: nextId(
      "p",
      graph.pins.map((one) => one.id),
    ),
    segment,
    kind,
    note: null,
    at: Math.max(0, Math.min(1, at)),
    coord: roundCoord(coord),
  };
  return { graph: { ...graph, pins: [...graph.pins, pin] }, pin };
}

export function updatePin(
  graph: GraphFile,
  id: PinId,
  change: Partial<Pick<Pin, "kind" | "note" | "coord">>,
): GraphFile {
  return {
    ...graph,
    pins: graph.pins.map((pin) =>
      pin.id === id
        ? {
            ...pin,
            ...change,
            ...(change.coord ? { coord: roundCoord(change.coord) } : {}),
            note:
              change.note !== undefined
                ? change.note?.trim() || null
                : pin.note,
          }
        : pin,
    ),
  };
}

export function removePin(graph: GraphFile, id: PinId): GraphFile {
  return { ...graph, pins: graph.pins.filter((pin) => pin.id !== id) };
}
