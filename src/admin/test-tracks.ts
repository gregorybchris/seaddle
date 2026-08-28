import { fromLocalMeters, haversineMeters } from "@/lib/geo/distance";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { Track } from "@/lib/models/track";

const ORIGIN: Coord = [-122.33, 47.68];

/** A coordinate a given number of meters east and north of a fixed origin. */
export function at(east: number, north: number): Coord {
  return fromLocalMeters({ x: east, y: north }, ORIGIN);
}

/**
 * A track through a list of waypoints, sampled at the spacing the real rides
 * use (~15 m) so index gaps and pass detection behave the way they will on
 * actual data.
 */
export function trackThrough(
  slug: string,
  waypoints: Coord[],
  spacingMeters = 15,
): Track {
  const points: ElevCoord[] = [];
  for (let leg = 0; leg < waypoints.length - 1; leg++) {
    const from = waypoints[leg];
    const to = waypoints[leg + 1];
    const steps = Math.max(
      1,
      Math.round(haversineMeters(from, to) / spacingMeters),
    );
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      points.push([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        10,
      ]);
    }
  }
  const last = waypoints[waypoints.length - 1];
  points.push([last[0], last[1], 10]);
  return { slug, name: slug, points, gaps: [], recordedAt: null };
}
