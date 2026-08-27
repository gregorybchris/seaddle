const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

/** Everything is metric internally; these exist only for display. */
export function miles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function feet(meters: number): number {
  return meters * FEET_PER_METER;
}

export function formatMiles(meters: number): string {
  return `${miles(meters).toFixed(1)} mi`;
}

export function formatFeet(meters: number): string {
  return `${Math.round(feet(meters)).toLocaleString()} ft`;
}
