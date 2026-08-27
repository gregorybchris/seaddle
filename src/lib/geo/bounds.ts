import type { Bounds, Coord, ElevCoord } from "@/lib/models/geo";
import { metersPerDegreeLat, metersPerDegreeLon } from "./distance";

export function boundsOf(points: (Coord | ElevCoord)[]): Bounds {
  if (points.length === 0) {
    throw new Error("Cannot take the bounds of zero points");
  }
  let [minLon, minLat] = [Infinity, Infinity];
  let [maxLon, maxLat] = [-Infinity, -Infinity];
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

export function aggregateBounds(all: Bounds[]): Bounds {
  if (all.length === 0) {
    throw new Error("Cannot aggregate zero bounds");
  }
  return {
    minLon: Math.min(...all.map((b) => b.minLon)),
    minLat: Math.min(...all.map((b) => b.minLat)),
    maxLon: Math.max(...all.map((b) => b.maxLon)),
    maxLat: Math.max(...all.map((b) => b.maxLat)),
  };
}

/** Grow a box by a distance in meters, converted per-axis at the box's latitude. */
export function padBounds(bounds: Bounds, meters: number): Bounds {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const dLat = meters / metersPerDegreeLat();
  const dLon = meters / metersPerDegreeLon(midLat);
  return {
    minLon: bounds.minLon - dLon,
    minLat: bounds.minLat - dLat,
    maxLon: bounds.maxLon + dLon,
    maxLat: bounds.maxLat + dLat,
  };
}

/**
 * Grow a box until the given point is at the middle of it.
 *
 * Fitting a map to a box puts the middle of that box in the middle of the
 * screen, which is rarely where the reader is looking. Squaring the box up
 * around a chosen point instead keeps that point still between one fit and the
 * next — so a cursor aimed at it does not have to chase the map. It costs some
 * zoom, since the box can end up twice as wide as it needed to be.
 */
export function centeredOn(anchor: Coord, bounds: Bounds): Bounds {
  const reachLon = Math.max(
    Math.abs(bounds.maxLon - anchor[0]),
    Math.abs(anchor[0] - bounds.minLon),
  );
  const reachLat = Math.max(
    Math.abs(bounds.maxLat - anchor[1]),
    Math.abs(anchor[1] - bounds.minLat),
  );
  return {
    minLon: anchor[0] - reachLon,
    maxLon: anchor[0] + reachLon,
    minLat: anchor[1] - reachLat,
    maxLat: anchor[1] + reachLat,
  };
}

export function boundsContain(bounds: Bounds, coord: Coord): boolean {
  return (
    coord[0] >= bounds.minLon &&
    coord[0] <= bounds.maxLon &&
    coord[1] >= bounds.minLat &&
    coord[1] <= bounds.maxLat
  );
}

export function boundsCenter(bounds: Bounds): Coord {
  return [
    (bounds.minLon + bounds.maxLon) / 2,
    (bounds.minLat + bounds.maxLat) / 2,
  ];
}
