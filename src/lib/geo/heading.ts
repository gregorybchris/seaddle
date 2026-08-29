import { flat, haversineMeters } from "./distance";
import type { Coord, ElevCoord } from "@/lib/models/geo";

/**
 * Which way you would be pointing riding from `a` to `b`, in degrees clockwise
 * from north.
 *
 * The forward azimuth on a sphere rather than the angle between two points on
 * a flat grid: over a segment's length the two barely differ, but the flat
 * version is wrong by the same amount everywhere and there is no reason to
 * carry that when the correct form is four lines.
 */
export function bearingDegrees(a: Coord, b: Coord): number {
  const toRad = Math.PI / 180;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const dLon = (b[0] - a[0]) * toRad;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}

const POINTS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

export type CompassPoint = (typeof POINTS)[number];

/**
 * A bearing in the words someone would actually use.
 *
 * Eight points, not sixteen: "north-north-east" is a precision nobody asks a
 * junction for, and the list this feeds is read aloud one item at a time.
 */
export function compassPoint(degrees: number): CompassPoint {
  const wrapped = ((degrees % 360) + 360) % 360;
  return POINTS[Math.round(wrapped / 45) % 8];
}

/**
 * The direction a segment sets off in, rather than where it ends up.
 *
 * A turn is chosen on the first few meters of it — the question at a junction
 * is which way you point, not where the segment eventually lands. Measuring end
 * to end would call a segment that leaves north and curves back south "south",
 * which is the opposite of what the rider is being asked to picture. Falls
 * back to the far end when the segment is shorter than the window.
 */
export function departureHeading(
  points: (Coord | ElevCoord)[],
  withinMeters = 40,
): number | null {
  if (points.length < 2) return null;

  const start = flat(points[0]);
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const here = flat(points[i]);
    travelled += haversineMeters(flat(points[i - 1]), here);
    if (travelled >= withinMeters) return bearingDegrees(start, here);
  }
  return bearingDegrees(start, flat(points[points.length - 1]));
}
