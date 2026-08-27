// Relative, not "@/", and it has to stay that way: this module is reached from
// vite.config.ts through the admin plugin, and Vite loads its own config before
// the alias exists.
import { elevationGain, polylineMeters, reversed } from "../geo/polyline";
import type { ElevCoord } from "@/lib/models/geo";
import type { SegmentDerived } from "@/lib/models/graph";

/**
 * Everything about a segment that follows from its shape.
 *
 * Computed once at build time and never stored beside the geometry it comes
 * from, so it cannot drift when a segment is re-cropped.
 */
export function deriveSegment(points: ElevCoord[]): SegmentDerived {
  return {
    meters: round(polylineMeters(points), 1),
    gainForward: round(elevationGain(points), 1),
    gainBackward: round(elevationGain(reversed(points)), 1),
  };
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
