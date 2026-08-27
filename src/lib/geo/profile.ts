import type { ElevCoord } from "@/lib/models/geo";
import { cumulativeMeters } from "./polyline";

export type Profile = {
  /** Elevations in meters, evenly spaced by distance along the line. */
  samples: number[];
  minMeters: number;
  maxMeters: number;
  /** Total length, so a caller can label the horizontal axis. */
  meters: number;
};

/**
 * An elevation profile sampled at even distances.
 *
 * Sampling by distance rather than by vertex is the whole point. Vertex spacing
 * varies — a drawn route puts one at every turn, a recording puts one every few
 * seconds — so plotting one column per vertex stretches the twisty parts and
 * squashes the straights, which draws a hill in the wrong place.
 */
export function elevationProfile(
  points: ElevCoord[],
  sampleCount = 48,
): Profile {
  if (points.length === 0) {
    return { samples: [], minMeters: 0, maxMeters: 0, meters: 0 };
  }
  if (points.length === 1) {
    const only = points[0][2];
    return {
      samples: new Array(sampleCount).fill(only),
      minMeters: only,
      maxMeters: only,
      meters: 0,
    };
  }

  const cumulative = cumulativeMeters(points);
  const meters = cumulative[cumulative.length - 1];
  const samples: number[] = [];

  let vertex = 1;
  for (let i = 0; i < sampleCount; i++) {
    const target = (i / (sampleCount - 1)) * meters;
    while (vertex < cumulative.length - 1 && cumulative[vertex] < target) {
      vertex++;
    }
    const span = cumulative[vertex] - cumulative[vertex - 1];
    const t = span === 0 ? 0 : (target - cumulative[vertex - 1]) / span;
    const from = points[vertex - 1][2];
    const to = points[vertex][2];
    samples.push(from + (to - from) * t);
  }

  return {
    samples,
    minMeters: Math.min(...samples),
    maxMeters: Math.max(...samples),
    meters,
  };
}
