/**
 * What a click on a road means.
 *
 * Two answers, and they cannot both be the same gesture. Building is the site's
 * reason to exist, but every road on the map already carries three
 * hand-reviewed attributes and a hill, and in build mode the only way to read
 * any of that is to hover — which a phone cannot do, and which is gone the
 * moment the pointer moves. Worse, a rider mid-route can only hover the roads
 * that happen to continue it, so the map's own data is least reachable exactly
 * when someone is deciding what to do next.
 *
 * So exploring is a mode rather than a second click: it frees every road on the
 * map to be tapped, not just the few that join the ride, and it puts the answer
 * somewhere that stays put long enough to read.
 */
export type Mode = "build" | "explore";

/**
 * What the map says about itself when the mode changes.
 *
 * A mode is the one kind of change to this map that alters what a click means
 * without altering anything a rider can see them doing — the icon swaps and the
 * panel swaps, and neither of those explains that the rules just changed. So
 * the switch says so once, in the same place the map says everything else, and
 * then gets out of the way.
 *
 * One line each. Two, at the width this is drawn. This is a confirmation of something the reader
 * just did on purpose, not a lesson — unlike the refusals in `why-closed`,
 * which have to teach a rule nobody knew was there and are given longer to be
 * read because of it.
 */
export function modeNotice(mode: Mode, pick: string) {
  return mode === "explore"
    ? {
        headline: "Explore mode",
        detail: `${pick} any road to read about it.`,
      }
    : {
        headline: "Build mode",
        detail: `${pick} a road to add it to your ride.`,
      };
}
