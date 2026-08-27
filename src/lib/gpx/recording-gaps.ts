import { haversineMeters } from "@/lib/geo/distance";
import type { ElevCoord } from "@/lib/models/geo";

/**
 * A pause longer than this, with real distance covered, means the recorder was
 * off rather than the rider being slow. Strava samples every few seconds, so
 * two minutes is far outside anything a moving recording produces.
 */
export const RECORDING_GAP_SECONDS = 120;

/**
 * And it only counts if the rider actually moved. Sitting still for an hour
 * outside a coffee shop leaves a long pause and no fabricated line.
 */
export const RECORDING_GAP_METERS = 100;

/**
 * Legs where the recorder was not running, as [from, to] index pairs.
 *
 * Returns nothing for a route with no timestamps: a drawn route's long straight
 * legs are deliberate — the road really does run straight between the two
 * vertices someone clicked — and there is no way to tell the two cases apart
 * from coordinates alone.
 */
export function findRecordingGaps(
  points: ElevCoord[],
  times: (number | null)[],
  gapSeconds = RECORDING_GAP_SECONDS,
  gapMeters = RECORDING_GAP_METERS,
): [number, number][] {
  const gaps: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    const before = times[i - 1];
    const after = times[i];
    if (before === null || after === null) continue;
    const seconds = (after - before) / 1000;
    if (seconds < gapSeconds) continue;
    const meters = haversineMeters(
      [points[i - 1][0], points[i - 1][1]],
      [points[i][0], points[i][1]],
    );
    if (meters < gapMeters) continue;
    gaps.push([i - 1, i]);
  }
  return gaps;
}

/** Whether an index falls strictly inside a fabricated span. */
export function insideGap(gaps: [number, number][], index: number): boolean {
  return gaps.some(([from, to]) => index > from && index < to);
}

/**
 * Break a ride into the stretches that were actually recorded.
 *
 * Used for drawing: a line straight across open water, left behind when a
 * recorder stopped on a ferry, should not appear as somewhere you can ride.
 */
export function splitAtGaps(
  points: ElevCoord[],
  gaps: [number, number][],
): ElevCoord[][] {
  if (gaps.length === 0) return points.length > 0 ? [points] : [];
  const pieces: ElevCoord[][] = [];
  let start = 0;
  for (const [from, to] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (from >= start) pieces.push(points.slice(start, from + 1));
    start = to;
  }
  pieces.push(points.slice(start));
  return pieces.filter((piece) => piece.length > 1);
}
