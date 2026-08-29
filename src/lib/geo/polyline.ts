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

/**
 * Legs of a line that count for no distance, given as the index of the point
 * each one arrives at.
 *
 * An assembled route can include a stretch nobody rides — the ferry across to
 * Bainbridge is eight miles of it — and everything measured along the line has
 * to skip that rather than lay eight flat miles across the middle of an
 * elevation chart. Passing the crossing's legs through here is what makes the
 * chart, the scrub, the band under a drag and the distance in the panel all
 * agree, without any of them being taught what a ferry is.
 */
export type Uncounted = ReadonlySet<number>;

/**
 * Distance from the start to each vertex. Same length as `points`, starting at
 * 0, and flat across any leg named in `uncounted`.
 */
export function cumulativeMeters(
  points: (Coord | ElevCoord)[],
  uncounted?: Uncounted,
): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    const leg = uncounted?.has(i)
      ? 0
      : haversineMeters(flat(points[i - 1]), flat(points[i]));
    out.push(out[i - 1] + leg);
  }
  return out;
}

/**
 * Total meters climbed, ignoring wobble below `thresholdMeters`.
 *
 * Raw GPX elevation jitters by a meter or two between neighboring points, and
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

export type Span = {
  /** How far along the line the stretch was started and ended from. */
  fromMeters: number;
  toMeters: number;
  /** The stretch's own length, and what it climbs read `from` → `to`. */
  meters: number;
  gain: number;
};

/** The point a given distance along a line, elevation included. */
function atMeters(
  points: ElevCoord[],
  cumulative: number[],
  meters: number,
): ElevCoord {
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < meters) i++;
  const span = cumulative[i] - cumulative[i - 1];
  const t = span === 0 ? 0 : (meters - cumulative[i - 1]) / span;
  const from = points[i - 1];
  const to = points[i];
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

const clampFraction = (fraction: number) => Math.max(0, Math.min(1, fraction));

/**
 * Measure one stretch of a line, cut at two fractions along it.
 *
 * This is the one place the site works out a distance and a climb for itself
 * rather than reading what the build computed, and it has to: a rider dragging
 * across the elevation chart is asking about a piece of road nobody authored,
 * so there is no stored answer to look up. It climbs with the same
 * `elevationGain` the pipeline uses, so a drag across the whole chart lands
 * back on the number already on the panel.
 *
 * The order of the two fractions is the direction the stretch is being read,
 * and it decides the climb — the same reason `crop` lets its indices run
 * backwards. Half a mile of hill climbs a few hundred feet one way round and
 * almost nothing the other, so a caller dragging right to left is asking about
 * the descent as a climb and has to be answered about the road it drew, not
 * the road drawn left to right. The length is the same either way.
 *
 * The ends are interpolated rather than snapped to the nearest vertex, so the
 * numbers describe the stretch that was actually asked for instead of the
 * vertices nearest to it.
 */
export function spanBetween(
  points: ElevCoord[],
  fromFraction: number,
  toFraction: number,
  uncounted?: Uncounted,
): Span {
  if (points.length < 2) {
    return { fromMeters: 0, toMeters: 0, meters: 0, gain: 0 };
  }

  const cumulative = cumulativeMeters(points, uncounted);
  const total = cumulative[cumulative.length - 1];
  const fromMeters = clampFraction(fromFraction) * total;
  const toMeters = clampFraction(toFraction) * total;

  return {
    fromMeters,
    toMeters,
    meters: Math.abs(toMeters - fromMeters),
    gain: elevationGain(
      sliceBetween(points, fromFraction, toFraction, uncounted),
    ),
  };
}

/**
 * The piece of a line between two fractions along it, ends interpolated.
 *
 * `spanBetween` measures this piece; this returns it, because the same drag
 * that asks how long a stretch is also has to be shown as a stretch on the
 * map. Cutting once and reading the answer off the cut keeps the two from
 * disagreeing about where the band starts.
 *
 * Runs from → to, backwards included, for the same reason `crop` does: the
 * direction is what the reader drew, and the climb is measured along it.
 */
export function sliceBetween(
  points: ElevCoord[],
  fromFraction: number,
  toFraction: number,
  uncounted?: Uncounted,
): ElevCoord[] {
  if (points.length < 2) return [...points];

  const cumulative = cumulativeMeters(points, uncounted);
  const total = cumulative[cumulative.length - 1];
  const fromMeters = clampFraction(fromFraction) * total;
  const toMeters = clampFraction(toFraction) * total;
  const low = Math.min(fromMeters, toMeters);
  const high = Math.max(fromMeters, toMeters);

  const slice: ElevCoord[] = [atMeters(points, cumulative, low)];
  for (let i = 0; i < points.length; i++) {
    if (cumulative[i] > low && cumulative[i] < high) slice.push(points[i]);
  }
  slice.push(atMeters(points, cumulative, high));

  return fromMeters <= toMeters ? slice : reversed(slice);
}

/**
 * Insert points so no two neighbors are further apart than `maxSpacingMeters`.
 *
 * Drawn routes place a vertex only where the road changes direction, so a
 * straight mile of trail can be two points. The line between them already *is*
 * the route, so interpolating along it adds no error — it just gives the
 * junction-finding tools something to hit.
 */
export function densify(
  points: ElevCoord[],
  maxSpacingMeters: number,
): ElevCoord[] {
  if (points.length < 2) return [...points];
  const out: ElevCoord[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const steps = Math.ceil(
      haversineMeters(flat(from), flat(to)) / maxSpacingMeters,
    );
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      out.push([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
      ]);
    }
    out.push(to);
  }
  return out;
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
  uncounted?: Uncounted,
): Coord {
  if (points.length === 0) {
    throw new Error("Cannot walk an empty polyline");
  }
  if (points.length === 1) return flat(points[0]);

  const cumulative = cumulativeMeters(points, uncounted);
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
