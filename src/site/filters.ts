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

/**
 * An attribute someone wrote down about a road.
 *
 * Every one of these is a small ordered or unordered set, which is what lets a
 * route be broken down by it and a legend list what the colors mean.
 */
export type Attribute = "steepness" | "protection" | "surroundings";

/**
 * What the map colors roads by.
 *
 * Grade is the odd one and deliberately so: it is not an attribute of a
 * segment at all but of the ground under it, read off the recorded elevation
 * point by point, so it colors *within* a segment rather than coloring the
 * whole of one. That also makes it the only encoding you cannot filter on —
 * there is no set of values to pick from, and half a road passing a filter
 * would mean nothing.
 */
export type Encoding = Attribute | "grade";

/**
 * In the order they are offered. No labels: they are read through `humanize`,
 * so there is no second list to keep in step with this one — which is how
 * "protection" came to be shown to riders in the first place.
 */
export const ENCODINGS: Encoding[] = [
  "protection",
  "steepness",
  "grade",
  "surroundings",
];

/** Whether an encoding is something a segment carries, rather than terrain. */
export function isAttribute(encoding: Encoding): encoding is Attribute {
  return encoding !== "grade";
}

export const ENCODING_VALUES: Record<Attribute, readonly string[]> = {
  steepness: STEEPNESSES,
  protection: PROTECTIONS,
  surroundings: SURROUNDINGS,
};

/**
 * The colors each scale is drawn in.
 *
 * Two constraints, and the second one bit. Every ordered scale steps down in
 * lightness as well as changing hue, so the order survives being read by
 * someone who cannot separate red from green — the lightness carries it alone.
 * And none of them may run pale: the basemap is nearly white, and a first
 * attempt whose lightest step sat around 203 simply vanished into it, which
 * looked from a distance like the coloring not working at all. Nothing here
 * goes above LIGHTEST_STEP.

 */
export const RAMPS: Record<Attribute, Record<string, string>> = {
  steepness: { flat: "#86b06a", rolling: "#c98a2e", steep: "#9c3b25" },
  protection: {
    unprotected: "#cf9b57",
    bikeLane: "#5f9358",
    bikePath: "#1c4632",
  },
  surroundings: { plain: "#97967f", pleasant: "#6d9464", scenic: "#2f6b48" },
};

/**
 * The ramp grade is drawn on, as [percent grade, color] stops.
 *
 * Continuous rather than stepped, because the thing being shown is continuous:
 * a hill easing off partway up should look like it is easing off, not hold one
 * color and then change its mind. It starts at the same green the flat end of
 * every other ramp uses and finishes past the same rust, so the map reads the
 * same way whichever encoding is on — pale and cool is easy going, dark and
 * hot is not.
 */
export const GRADE_STOPS: [number, string][] = [
  [0, "#86b06a"],
  [2, "#b3a94f"],
  [4, "#c98a2e"],
  [7, "#a85228"],
  [12, "#7d2b1c"],
];

/** Anything lighter than this disappears into the basemap. */
export const LIGHTEST_STEP = 170;

/** Perceived lightness, 0 to 255. */
export function lightnessOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export type Breakdown = { value: string; meters: number; share: number }[];

/**
 * How a route divides up by one attribute, longest share first.
 *
 * Measured in distance rather than in segments, because a route is nine tenths
 * good bike lane whether that is one long segment or twelve short ones, and
 * counting segments would say otherwise.
 */
export function breakdown(
  segments: SiteSegment[],
  attribute: Attribute,
): Breakdown {
  const totals = new Map<string, number>();
  let total = 0;
  for (const segment of segments) {
    const value = segment[attribute];
    totals.set(value, (totals.get(value) ?? 0) + segment.meters);
    total += segment.meters;
  }
  if (total === 0) return [];

  return [...totals.entries()]
    .map(([value, meters]) => ({ value, meters, share: meters / total }))
    .sort((a, b) => b.meters - a.meters);
}
