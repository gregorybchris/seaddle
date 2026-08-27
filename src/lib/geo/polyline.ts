import type { Coord, ElevCoord } from "@/lib/models/geo";
import {
  flat,
  fromLocalMeters,
  haversineMeters,
  toLocalMeters,
} from "./distance";

export function polylineMeters(points: (Coord | ElevCoord)[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(flat(points[i - 1]), flat(points[i]));
  }
  return total;
}

/** Distance from the start to each vertex. Same length as `points`, starting at 0. */
export function cumulativeMeters(points: (Coord | ElevCoord)[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(
      out[i - 1] + haversineMeters(flat(points[i - 1]), flat(points[i])),
    );
  }
  return out;
}

/**
 * Total meters climbed, ignoring wobble below `thresholdMeters`.
 *
 * Raw GPX elevation jitters by a meter or two between neighbouring points, and
 * summing every positive delta turns a flat ride down the Burke-Gilman into
 * hundreds of feet of fictional climbing. So we only bank a rise once it has
 * held for the full threshold, and reset the reference on any real descent.
 */
export function elevationGain(
  points: ElevCoord[],
  thresholdMeters = 2,
): number {
  if (points.length < 2) return 0;
  let gain = 0;
  let reference = points[0][2];
  for (const point of points) {
    const delta = point[2] - reference;
    if (delta >= thresholdMeters) {
      gain += delta;
      reference = point[2];
    } else if (delta <= -thresholdMeters) {
      reference = point[2];
    }
  }
  return gain;
}

/** Reversing a line swaps which direction is the climb. */
export function reversed(points: ElevCoord[]): ElevCoord[] {
  return [...points].reverse();
}

export type Projection = {
  /** Index of the vertex starting the sub-segment the point landed on. */
  index: number;
  /** How far along that sub-segment, 0..1. */
  t: number;
  coord: Coord;
  /** Perpendicular distance from the queried point to the line. */
  distanceMeters: number;
  /** Distance from the start of the polyline to the projection. */
  alongMeters: number;
  /** `alongMeters` as a share of total length — a pin's `at`. */
  fraction: number;
};

/**
 * Drop a point onto the nearest place on a polyline.
 *
 * This is how a pin gets its `at` (click a fountain, get a position along the
 * segment) and how the admin turns a clicked junction into an index on a track.
 */
export function projectOntoPolyline(
  points: (Coord | ElevCoord)[],
  target: Coord,
): Projection {
  if (points.length === 0) {
    throw new Error("Cannot project onto an empty polyline");
  }
  if (points.length === 1) {
    return {
      index: 0,
      t: 0,
      coord: flat(points[0]),
      distanceMeters: haversineMeters(flat(points[0]), target),
      alongMeters: 0,
      fraction: 0,
    };
  }

  const cumulative = cumulativeMeters(points);
  const total = cumulative[cumulative.length - 1];
  let best: Projection | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const origin = flat(points[i]);
    const end = toLocalMeters(flat(points[i + 1]), origin);
    const point = toLocalMeters(target, origin);
    const lengthSquared = end.x ** 2 + end.y ** 2;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, (point.x * end.x + point.y * end.y) / lengthSquared),
          );
    const projected = fromLocalMeters({ x: end.x * t, y: end.y * t }, origin);
    const distanceMeters = haversineMeters(projected, target);
    if (best === null || distanceMeters < best.distanceMeters) {
      const alongMeters =
        cumulative[i] + (cumulative[i + 1] - cumulative[i]) * t;
      best = {
        index: i,
        t,
        coord: projected,
        distanceMeters,
        alongMeters,
        fraction: total === 0 ? 0 : alongMeters / total,
      };
    }
  }

  return best!;
}

/** The coordinate a given fraction of the way along a line — the inverse of a pin's `at`. */
export function coordAtFraction(
  points: (Coord | ElevCoord)[],
  fraction: number,
): Coord {
  if (points.length === 0) {
    throw new Error("Cannot walk an empty polyline");
  }
  if (points.length === 1) return flat(points[0]);

  const cumulative = cumulativeMeters(points);
  const total = cumulative[cumulative.length - 1];
  const targetMeters = Math.max(0, Math.min(1, fraction)) * total;

  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i] >= targetMeters) {
      const span = cumulative[i] - cumulative[i - 1];
      const t = span === 0 ? 0 : (targetMeters - cumulative[i - 1]) / span;
      const origin = flat(points[i - 1]);
      const end = toLocalMeters(flat(points[i]), origin);
      return fromLocalMeters({ x: end.x * t, y: end.y * t }, origin);
    }
  }
  return flat(points[points.length - 1]);
}

/**
 * Cut a sub-path out of a track between two point indices, in either direction.
 *
 * Order matters and is allowed to be backwards: a track that runs B → A is a
 * perfectly good source for the segment A → B, it just has to be reversed on
 * the way out so stored geometry always runs from → to.
 */
export function crop(
  points: ElevCoord[],
  startIndex: number,
  endIndex: number,
): ElevCoord[] {
  const low = Math.min(startIndex, endIndex);
  const high = Math.max(startIndex, endIndex);
  const slice = points.slice(low, high + 1);
  return startIndex <= endIndex ? slice : reversed(slice);
}

/**
 * Pin the ends of a cropped path to the exact junction coordinates.
 *
 * Without this, two segments meeting at one node end a few meters apart —
 * wherever their source tracks happened to have a point — and the map renders a
 * visible hairline gap at every intersection.
 */
export function snapEnds(
  points: ElevCoord[],
  start: Coord,
  end: Coord,
): ElevCoord[] {
  if (points.length === 0) return points;
  const out = [...points];
  out[0] = [start[0], start[1], out[0][2]];
  out[out.length - 1] = [end[0], end[1], out[out.length - 1][2]];
  return out;
}
