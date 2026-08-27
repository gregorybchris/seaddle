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
