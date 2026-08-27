import {
  LANE_QUALITIES,
  SCENICS,
  STEEPNESSES,
  SURFACES,
  type LaneQuality,
  type Scenic,
  type Steepness,
  type Surface,
} from "@/lib/models/graph";
import type { SiteSegment } from "./graph-data";

/**
 * What a rider will put up with.
 *
 * Steepness, bike lane and scenic value are ordered scales, so they are
 * thresholds — "nothing steeper than hilly", "at least a decent bike lane" —
 * which is how the constraint is actually held in someone's head. Surface is a
 * set of things, not a scale, so it is a set here too. A row of checkboxes for
 * the ordered ones would permit nonsense like flat and steep but not hilly.
 */
export type Filters = {
  steepest: Steepness;
  leastLaneQuality: LaneQuality;
  leastScenic: Scenic;
  surfaces: Surface[];
};

export const NO_FILTERS: Filters = {
  steepest: "steep",
  leastLaneQuality: "poor",
  leastScenic: "low",
  surfaces: [...SURFACES],
};

export function isFiltering(filters: Filters): boolean {
  return (
    filters.steepest !== NO_FILTERS.steepest ||
    filters.leastLaneQuality !== NO_FILTERS.leastLaneQuality ||
    filters.leastScenic !== NO_FILTERS.leastScenic ||
    filters.surfaces.length !== SURFACES.length
  );
}

/** Whether a segment clears every bar the rider set. */
export function passes(segment: SiteSegment, filters: Filters): boolean {
  return (
    STEEPNESSES.indexOf(segment.steepness) <=
      STEEPNESSES.indexOf(filters.steepest) &&
    LANE_QUALITIES.indexOf(segment.laneQuality) >=
      LANE_QUALITIES.indexOf(filters.leastLaneQuality) &&
    SCENICS.indexOf(segment.scenic) >= SCENICS.indexOf(filters.leastScenic) &&
    filters.surfaces.includes(segment.surface)
  );
}

/** What the map colors segments by. */
export type Encoding = "steepness" | "laneQuality" | "scenic" | "surface";

/**
 * In the order they are offered. No labels: they are read through `humanize`,
 * so there is no second list to keep in step with this one — which is how
 * "laneQuality" came to be shown to riders in the first place.
 */
export const ENCODINGS: Encoding[] = [
  "laneQuality",
  "steepness",
  "scenic",
  "surface",
];

export const ENCODING_VALUES: Record<Encoding, readonly string[]> = {
  steepness: STEEPNESSES,
  laneQuality: LANE_QUALITIES,
  scenic: SCENICS,
  surface: SURFACES,
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
 *
 * Surface is a set of materials rather than a scale, so it gets separate hues
 * instead of a ramp, reinforced by a dash pattern that does not rely on color.
 */
export const RAMPS: Record<Encoding, Record<string, string>> = {
  steepness: { flat: "#86b06a", hilly: "#c98a2e", steep: "#9c3b25" },
  laneQuality: {
    poor: "#cf9b57",
    fair: "#a8a24e",
    good: "#5f9358",
    great: "#1c4632",
  },
  scenic: { low: "#97967f", medium: "#6d9464", high: "#2f6b48" },
  surface: { asphalt: "#4a6b7c", gravel: "#b98a4b", dirt: "#8a5a3b" },
};

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
  encoding: Encoding,
): Breakdown {
  const totals = new Map<string, number>();
  let total = 0;
  for (const segment of segments) {
    const value = valueOf(segment, encoding);
    totals.set(value, (totals.get(value) ?? 0) + segment.meters);
    total += segment.meters;
  }
  if (total === 0) return [];

  return [...totals.entries()]
    .map(([value, meters]) => ({ value, meters, share: meters / total }))
    .sort((a, b) => b.meters - a.meters);
}

function valueOf(segment: SiteSegment, encoding: Encoding): string {
  return segment[encoding];
}
