import type { Coord, ElevCoord } from "@/lib/models/geo";

const EARTH_RADIUS_METERS = 6371008.8; // mean radius, WGS84

function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Great-circle distance in meters.
 *
 * Everything in this project is metric internally and converted only for
 * display. tuxc's version returned miles, which is exactly the kind of unit
 * ambiguity that produces a route claiming 6,000 feet of climbing.
 */
export function haversineMeters(a: Coord, b: Coord): number {
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function metersPerDegreeLat(): number {
  return (Math.PI / 180) * EARTH_RADIUS_METERS;
}

export function metersPerDegreeLon(atLat: number): number {
  return metersPerDegreeLat() * Math.cos(radians(atLat));
}

export type LocalPoint = { x: number; y: number };

/**
 * Flatten a coordinate to meters east/north of an origin.
 *
 * An equirectangular approximation, which is accurate to well under a meter at
 * the scale a single segment spans. Perpendicular-distance math wants a plane,
 * and doing it on the sphere would be slower and no more correct here.
 */
export function toLocalMeters(coord: Coord, origin: Coord): LocalPoint {
  return {
    x: (coord[0] - origin[0]) * metersPerDegreeLon(origin[1]),
    y: (coord[1] - origin[1]) * metersPerDegreeLat(),
  };
}

export function fromLocalMeters(local: LocalPoint, origin: Coord): Coord {
  return [
    origin[0] + local.x / metersPerDegreeLon(origin[1]),
    origin[1] + local.y / metersPerDegreeLat(),
  ];
}

/** Drops elevation. Most geometry cares only about where a point is on the map. */
export function flat(point: Coord | ElevCoord): Coord {
  return [point[0], point[1]];
}
