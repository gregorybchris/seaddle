import type { Coord, ElevCoord } from "@/lib/models/geo";
import { flat, toLocalMeters } from "./distance";

/** Perpendicular distance in meters from `point` to the line through `a` and `b`. */
function perpendicularMeters(
  point: ElevCoord,
  a: ElevCoord,
  b: ElevCoord,
): number {
  const origin = flat(a);
  const p = toLocalMeters(flat(point), origin);
  const q = toLocalMeters(flat(b), origin);
  const lengthSquared = q.x ** 2 + q.y ** 2;
  if (lengthSquared === 0) return Math.hypot(p.x, p.y);
  // Cross product of the segment with the offset vector, over the segment length.
  return Math.abs(q.x * p.y - q.y * p.x) / Math.sqrt(lengthSquared);
}

/**
 * Douglas–Peucker, in meters, preserving elevation on every kept point.
 *
 * Import resamples every ride to a 15 m vertex spacing, and most of those added
 * vertices sit on straight runs where they carry nothing. A tolerance around a
 * metre removes exactly those and keeps the shape of a curve.
 *
 * Iterative rather than recursive on purpose: a 5,000-point track that happens
 * to split badly would recurse 5,000 deep, and the failure mode is a stack
 * overflow during a build rather than anything a test would catch.
 */
export function simplify(
  points: ElevCoord[],
  toleranceMeters: number,
): ElevCoord[] {
  if (points.length <= 2) return [...points];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let farthest = -1;
    let farthestDistance = toleranceMeters;
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularMeters(
        points[i],
        points[start],
        points[end],
      );
      if (distance > farthestDistance) {
        farthest = i;
        farthestDistance = distance;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/**
 * Six decimal places, about 11 cm.
 *
 * Five would quantise to roughly a metre, which is the same order as the
 * simplification tolerance — the rounding would then add its own visible
 * stair-stepping to a line that had just been carefully kept smooth. The extra
 * digit costs one character per coordinate.
 */
const PRECISION = 1e6;

export function roundCoord(coord: Coord): Coord {
  return [
    Math.round(coord[0] * PRECISION) / PRECISION,
    Math.round(coord[1] * PRECISION) / PRECISION,
  ];
}

/**
 * Trim float noise without coarsening the line. Elevation gets one decimal,
 * which is already finer than the data's real accuracy.
 */
export function roundPoint(point: ElevCoord): ElevCoord {
  return [
    Math.round(point[0] * PRECISION) / PRECISION,
    Math.round(point[1] * PRECISION) / PRECISION,
    Math.round(point[2] * 10) / 10,
  ];
}
