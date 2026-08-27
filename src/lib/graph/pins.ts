import { coordAtFraction } from "../geo/polyline";
import type { Coord, ElevCoord } from "../models/geo";
import type { SegmentId } from "../models/graph";

/** Enough of a pin to place it along a road. Both halves of the app have more. */
type Placed = { segment: SegmentId; at: number };

/**
 * The pins on a route, in the order they are ridden past.
 *
 * Shared rather than living with the admin's editing code, because the site
 * needs it too and nothing from the admin may reach the shipped bundle.
 */
export function pinsAlong<T extends Placed>(
  pins: T[],
  order: { segment: SegmentId; reversed: boolean }[],
): T[] {
  return order.flatMap(({ segment, reversed }) => {
    const here = pins.filter((pin) => pin.segment === segment);
    here.sort((a, b) => (reversed ? b.at - a.at : a.at - b.at));
    return here;
  });
}

/** Where a pin sits along its road, for drawing it without storing a duplicate. */
export function pinOnLine(
  pin: Placed,
  points: ElevCoord[],
  fallback: Coord,
): Coord {
  return points.length > 1 ? coordAtFraction(points, pin.at) : fallback;
}
