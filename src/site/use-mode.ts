import { useState } from "react";
import { readStored, writeStored } from "@/lib/utilities/storage";
import type { Mode } from "./mode";
import { encodedFromUrl } from "./use-route-history";

/** Kept in the browser, so a rider who prefers to read the map keeps reading it
 *  across a reload — the same as their choice of ground. */
const STORE_KEY = "seaddle:mode";

/**
 * The mode nobody has chosen yet.
 *
 * Exploring, because a first arrival is a stranger looking at a map of a city
 * they may not know, and the question they have is what these lines are — not
 * which of them to string together. Building answers a question they have not
 * asked yet, and until they ask it the shovel puts most of the map out of reach
 * of the one gesture they have: in build mode only the roads that continue the
 * ride can be tapped, so the site's own data is hidden behind a commitment.
 * Exploring costs nothing to leave, and the notice on the way out says so.
 *
 * Unless a ride came in the link. Then the rider was sent something to look at,
 * and the panel that holds it — its distance, its climb, its profile, the GPX
 * button — is the route panel; opening on the segment panel would draw their
 * ride on the map and then talk about whichever road they touched first.
 */
function firstVisit(): Mode {
  return encodedFromUrl() ? "build" : "explore";
}

function remembered(): Mode {
  const stored = readStored(STORE_KEY);
  // Only the two words this site writes count as a choice. Anything else — a
  // missing value, a blocked store, whatever a future build might leave here —
  // is nobody having chosen, which is what `firstVisit` is for.
  return stored === "build" || stored === "explore" ? stored : firstVisit();
}

/**
 * What a click on a road does, remembered between visits.
 *
 * Held like the basemap and for the same reason: it is a setting rather than a
 * step in anything, and being put back into a mode you deliberately left is the
 * kind of small insult a page reload should not be able to deliver. Which is
 * also why a link carrying a ride only overrides the default and not a stored
 * choice — a rider who picked exploring is still shown the ride on the map, one
 * press of the shovel from the panel about it.
 *
 * Only the mode. Which road was being read is not a setting — it is where the
 * reader had got to, and restoring it would put a panel of details on screen
 * about a road nobody just tapped.
 */
export function useMode(): [Mode, (mode: Mode) => void] {
  const [mode, setMode] = useState<Mode>(remembered);

  function choose(next: Mode) {
    setMode(next);
    writeStored(STORE_KEY, next);
  }

  return [mode, choose];
}
