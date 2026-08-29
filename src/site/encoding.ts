import {
  ChartLineUp,
  Mountains,
  Shield,
  Tree,
  type Icon,
} from "@phosphor-icons/react";
import { PROTECTIONS, STEEPNESSES, SURROUNDINGS } from "@/lib/models/graph";
import type { Tone } from "@/widgets/badge";
import { STEEPEST_GRADE } from "./grade";
import type { SiteSegment } from "./graph-data";

/**
 * An attribute someone wrote down about a segment.
 *
 * Every one of these is a small ordered or unordered set, which is what lets a
 * route be broken down by it and a legend list what the colors mean.
 */
export type Attribute = "steepness" | "protection" | "surroundings";

/**
 * What the map colors segments by.
 *
 * Grade is the odd one and deliberately so: it is not an attribute of a
 * segment at all but of the ground under it, read off the recorded elevation
 * point by point, so it colors *within* a segment rather than coloring the
 * whole of one. It is also the only one with no set of values to name, which is
 * why the key draws it as a bar and the others as a row of swatches.
 */
export type Encoding = Attribute | "grade";

/**
 * In the order they are offered. No labels: they are read through `humanize`,
 * so there is no second list to keep in step with this one — which is how
 * "protection" came to be shown to riders in the first place.
 */
export const ENCODINGS: Encoding[] = [
  "grade",
  "steepness",
  "protection",
  "surroundings",
];

/** Whether an encoding is something a segment carries, rather than terrain. */
export function isAttribute(encoding: Encoding): encoding is Attribute {
  return encoding !== "grade";
}

/**
 * The mark that stands for each, and a line saying what it answers.
 *
 * Two tables, which everything else about these avoids: the legend and the
 * breakdown read the values through `humanize` precisely so there is no second
 * list to keep in step. These earn it because no rule turns "surroundings" into
 * a tree, and because the picker offers all four at once — a rider choosing
 * between them is comparing four questions, and the names alone do not say that
 * grade is read along a segment while the other three are one word about the
 * whole of it. Keyed on `Encoding`, so a fifth cannot be added without these
 * failing to compile.
 */
export const ENCODING_ICONS: Record<Encoding, Icon> = {
  grade: ChartLineUp,
  steepness: Mountains,
  protection: Shield,
  surroundings: Tree,
};

export const ENCODING_BLURBS: Record<Encoding, string> = {
  grade: "The slope of the ground -- 45° is 100%.",
  steepness: "Approximate steepness of the segment.",
  protection: "Kind of lane or path protection on the segment.",
  surroundings: "How beautiful the surroundings of the segment are.",
};

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
  // Protection leaves the greens to the route itself, which is drawn in the
  // deep forest this scale used to end on. Magenta then violet keeps the
  // lightness stepping down the way every scale here does, and puts the two
  // protected steps on a hue nothing else on the map uses.
  protection: {
    unprotected: "#cf9b57",
    bikeLane: "#b04a86",
    bikePath: "#533178",
  },
  surroundings: { plain: "#97967f", pleasant: "#6d9464", beautiful: "#2f6b48" },
};

/**
 * Whether a value is good news, for the badges in the explore panel.
 *
 * A second reading of the same three scales, and deliberately not the same one
 * as `RAMPS`. A ramp answers "which step of this scale is this segment on",
 * which is what a map needs — every value distinct, the order carried by
 * lightness. A badge answers "is this in my favour", which is a different
 * question and one that two values can answer the same way.
 *
 * That is why protection reads red-then-green-then-green here while the map
 * draws it tan, magenta, violet: a bike lane and a bike path are both a yes to
 * a beginner asking whether they will be riding in traffic, and the distinction
 * between them belongs on the map, where there is a legend to explain it. It is
 * the one place the two readings disagree — steepness and surroundings already
 * ran green-amber-red and gray-green-green on the map, and the badges keep it.
 *
 * The cost is that "bike lane" is a green pill beside a magenta line. Worth it:
 * a rider reading one segment wants the verdict, and a rider reading the whole
 * map wants the categories.
 */
export const TONES: Record<Attribute, Record<string, Tone>> = {
  steepness: { flat: "good", rolling: "caution", steep: "poor" },
  protection: { unprotected: "poor", bikeLane: "good", bikePath: "good" },
  surroundings: { plain: "neutral", pleasant: "good", beautiful: "good" },
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

/**
 * The grade ramp as CSS gradient stops.
 *
 * Shared by the key on the map and the card that turns it on, so the bar a
 * rider picks from is the bar they then read the segments against. Scaled to
 * `STEEPEST_GRADE`, which is where the ramp stops distinguishing anyway.
 */
export function gradeRamp(): string {
  return GRADE_STOPS.map(
    ([grade, color]) => `${color} ${(grade / STEEPEST_GRADE) * 100}%`,
  ).join(", ");
}

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
