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
};
