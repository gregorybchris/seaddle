import type { ElevCoord } from "./geo";

/**
 * A full-resolution source ride, imported from src-gpx.
 *
 * These are the raw material the admin crops segments out of. They are dev-only
 * and never bundled — 21 files at ~5 m point spacing is 8.7 MB, which is an
 * order of magnitude more than the whole shipped graph.
 */
export type Track = {
  slug: string;
  name: string;
  points: ElevCoord[];
};
