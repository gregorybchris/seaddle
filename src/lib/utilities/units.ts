const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

/**
 * Which units a rider reads the numbers in.
 *
 * One choice covering both distance and height, not two. Nobody holds "miles,
 * with the climbing in meters" — the pair is one identity, and offering it as
 * two switches would be two questions where a rider has a single answer.
 */
export type UnitSystem = "imperial" | "metric";

export const UNIT_SYSTEMS: UnitSystem[] = ["imperial", "metric"];

/**
 * What each is called where it is chosen.
 *
 * Named by the units themselves rather than by the system: "imperial" is a
 * word about measurement history, and "miles & feet" is the thing a rider is
 * actually picking between.
 */
export const UNIT_LABELS: Record<UnitSystem, string> = {
  imperial: "miles & feet",
  metric: "km & meters",
};

/** Everything is metric internally; these exist only for display. */
export function miles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function feet(meters: number): number {
  return meters * FEET_PER_METER;
}

export function kilometers(meters: number): number {
  return meters / 1000;
}

export function formatMiles(meters: number): string {
  return `${miles(meters).toFixed(1)} mi`;
}

export function formatFeet(meters: number): string {
  return `${Math.round(feet(meters)).toLocaleString()} ft`;
}

export function formatKilometers(meters: number): string {
  return `${kilometers(meters).toFixed(1)} km`;
}

export function formatMeters(meters: number): string {
  return `${Math.round(meters).toLocaleString()} m`;
}

/**
 * A distance along the ground, in the units the reader asked for.
 *
 * Both scales get one decimal rather than a rule per unit. A tenth of a mile
 * and a tenth of a kilometer are both about the resolution a rider plans at,
 * and rounding kilometers to whole numbers would make a short ride read as two
 * or three of the same figure while it grew.
 */
export function formatDistance(meters: number, system: UnitSystem): string {
  return system === "metric" ? formatKilometers(meters) : formatMiles(meters);
}

/** A height: climbed, or above the sea. Whole units either way — nobody plans
 *  around a tenth of a foot, and a meter is already finer than the data. */
export function formatClimb(meters: number, system: UnitSystem): string {
  return system === "metric" ? formatMeters(meters) : formatFeet(meters);
}

/** The bare number, for a range that carries one unit word across both ends. */
export function climbValue(meters: number, system: UnitSystem): number {
  return Math.round(system === "metric" ? meters : feet(meters));
}
