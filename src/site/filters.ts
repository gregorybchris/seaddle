import {
  PROTECTIONS,
  STEEPNESSES,
  SURROUNDINGS,
  type Protection,
  type Steepness,
  type Surroundings,
} from "@/lib/models/graph";
import type { SiteSegment } from "./graph-data";

/**
 * What a rider will put up with.
 *
 * All three are ordered scales, so all three are thresholds — "nothing steeper
 * than rolling", "at least a bike lane" — which is how the constraint is
 * actually held in someone's head. A row of checkboxes would permit nonsense
 * like flat and steep but not rolling.
 */
export type Filters = {
  steepest: Steepness;
  leastProtection: Protection;
  leastSurroundings: Surroundings;
};

export const NO_FILTERS: Filters = {
  steepest: "steep",
  leastProtection: "unprotected",
  leastSurroundings: "plain",
};

export function isFiltering(filters: Filters): boolean {
  return (
    filters.steepest !== NO_FILTERS.steepest ||
    filters.leastProtection !== NO_FILTERS.leastProtection ||
    filters.leastSurroundings !== NO_FILTERS.leastSurroundings
  );
}

/** Whether a segment clears every bar the rider set. */
export function passes(segment: SiteSegment, filters: Filters): boolean {
  return (
    STEEPNESSES.indexOf(segment.steepness) <=
      STEEPNESSES.indexOf(filters.steepest) &&
    PROTECTIONS.indexOf(segment.protection) >=
      PROTECTIONS.indexOf(filters.leastProtection) &&
    SURROUNDINGS.indexOf(segment.surroundings) >=
      SURROUNDINGS.indexOf(filters.leastSurroundings)
  );
}
