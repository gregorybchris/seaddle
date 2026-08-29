import { useMemo, useSyncExternalStore } from "react";
import { readStored, writeStored } from "./utilities/storage";
import {
  formatClimb,
  formatClimbRange,
  formatClimbRate,
  formatDistance,
  type UnitSystem,
} from "./utilities/units";

/** Kept in the browser like the mode and the choice of ground: a preference,
 *  not a step in anything. */
const STORE_KEY = "seaddle:units";

/**
 * The formatters, already carrying the rider's answer.
 *
 * Bound rather than handed out as `(meters, system)` pairs, because the system
 * is the same for every number on the screen and threading it through a dozen
 * call sites is a dozen chances to thread it through eleven.
 */
export type Units = {
  system: UnitSystem;
  choose: (system: UnitSystem) => void;
  /** "12.4 mi" or "19.9 km". */
  distance: (meters: number) => string;
  /** "840 ft" or "256 m". */
  climb: (meters: number) => string;
  /** How steeply a stretch climbs over its length: "84 ft/mi" or "16 m/km". */
  climbRate: (gainMeters: number, overMeters: number) => string | null;
  /** A climb that is not one number, where both ends share the unit word. */
  climbRange: (minMeters: number, maxMeters: number) => string;
};

/**
 * The regions that ride in miles, for a browser that has said where it is.
 *
 * Imperial is the default rather than metric, because this is a map of Seattle
 * and most of the people opening it are riding in Seattle. But a visitor
 * planning a trip should not have to find a setting before a number means
 * anything, so a browser naming a region gets that region's answer — and a
 * language tag with no region in it ("en" rather than "en-GB") has said
 * nothing, which leaves the default standing.
 */
const MILE_REGIONS = new Set(["US", "GB", "LR", "MM"]);

function firstVisit(): UnitSystem {
  try {
    const region = new Intl.Locale(navigator.language).region;
    return !region || MILE_REGIONS.has(region) ? "imperial" : "metric";
  } catch {
    // A malformed tag, or no navigator at all. Neither is worth a broken page.
    return "imperial";
  }
}

function remembered(): UnitSystem {
  const stored = readStored(STORE_KEY);
  // Only the two words this site writes count as an answer. Anything else is
  // nobody having chosen, which is what `firstVisit` is for.
  return stored === "imperial" || stored === "metric" ? stored : firstVisit();
}

/**
 * One answer for the whole page, held outside React.
 *
 * The mode and the basemap are each read by one component and can live in its
 * state; units are read by seven — both panels, the hover label, the chart, the
 * breakdown, the turnings — none of which is anywhere near the others in the
 * tree. A store they all subscribe to says what a context would say with less
 * ceremony: no provider to remember to wrap anything in, and a widget shared
 * with the admin needs nothing done to it to be rendered outside the site.
 *
 * Read on the first subscription rather than at import, so nothing touches
 * `localStorage` merely because this module was pulled into a bundle.
 */
let current: UnitSystem | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): UnitSystem {
  return (current ??= remembered());
}

function choose(system: UnitSystem): void {
  if (system === snapshot()) return;
  current = system;
  writeStored(STORE_KEY, system);
  for (const listener of listeners) listener();
}

export function useUnits(): Units {
  const system = useSyncExternalStore(subscribe, snapshot);

  return useMemo(
    () => ({
      system,
      choose,
      distance: (meters: number) => formatDistance(meters, system),
      climb: (meters: number) => formatClimb(meters, system),
      climbRate: (gainMeters: number, overMeters: number) =>
        formatClimbRate(gainMeters, overMeters, system),
      climbRange: (minMeters: number, maxMeters: number) =>
        formatClimbRange(minMeters, maxMeters, system),
    }),
    [system],
  );
}
