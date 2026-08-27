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
 * Mapometer exports points about 5 m apart, which is far more detail than a map
 * at riding zoom can render. Six meters of tolerance cuts most of it without
 * visibly moving the line.
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

/** Five decimal places, ~1 m. Junction coordinates are stored at this precision. */
export function roundCoord(coord: Coord): Coord {
  return [Math.round(coord[0] * 1e5) / 1e5, Math.round(coord[1] * 1e5) / 1e5];
}

/**
 * Round to five decimal places (~1 m) to stop float noise from bloating the
 * shipped GeoJSON. Elevation gets one decimal, which is already finer than the
 * data's real accuracy.
 */
export function roundPoint(point: ElevCoord): ElevCoord {
  return [
    Math.round(point[0] * 1e5) / 1e5,
    Math.round(point[1] * 1e5) / 1e5,
    Math.round(point[2] * 10) / 10,
  ];
}
