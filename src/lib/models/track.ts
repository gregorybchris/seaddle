import type { ElevCoord } from "./geo";

/**
 * The furthest apart two stored track points may be.
 *
 * The admin finds junctions by looking for track *vertices* near a click, so a
 * track whose vertices are 156 m apart is invisible to a 25 m search — the
 * nearest one can be 78 m away with the road running right under the cursor.
 * Import resamples every ride to this spacing, which bounds that error at half
 * of it and makes the tooling's radii true by construction rather than by
 * assumption about the exporter.
 */
export const MAX_TRACK_SPACING_METERS = 15;

/**
 * A full-resolution source ride, imported from src-gpx.
 *
 * These are the raw material the admin crops segments out of. They are dev-only
 * and never bundled — an order of magnitude more data than the whole shipped
 * graph.
 *
 * Sources are mixed: some rides are drawn in Mapometer and snapped to roads,
 * others are recorded by Strava off a GPS. Nothing downstream is allowed to
 * care which, so both are resampled and filtered the same way.
 */
export type Track = {
  slug: string;
  name: string;
  points: ElevCoord[];
  /**
   * Spans of `points` the recorder never observed, as [from, to] index pairs.
   *
   * A GPS that stops recording — below deck on a ferry, in a tunnel, when a
   * phone dies — leaves a straight line between where it stopped and where it
   * resumed. That line is not a road, and import fills it with vertices like
   * any other straight, so it has to be marked: nothing may snap to it and it
   * must not be drawn as if it were somewhere you can ride.
   *
   * The points stay in the array so that indices, and therefore every segment
   * cut from this ride, keep meaning what they did.
   */
  gaps: [number, number][];
  /** When it was ridden, ISO 8601, or null for a route that was drawn. */
  recordedAt: string | null;
};
