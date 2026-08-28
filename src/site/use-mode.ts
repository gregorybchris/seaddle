import { useState } from "react";
import { readStored, writeStored } from "@/lib/utilities/storage";
import type { Mode } from "./mode";

/** Kept in the browser, so a rider who prefers to read the map keeps reading it
 *  across a reload — the same as their choice of ground. */
const STORE_KEY = "seaddle:mode";

function remembered(): Mode {
  // Anything that is not the stored word for exploring is building, which
  // covers a missing value, a blocked store, and whatever a future build might
  // have written here — the mode a rider has never chosen is the one the site
  // is for.
  return readStored(STORE_KEY) === "explore" ? "explore" : "build";
}

/**
 * What a click on a road does, remembered between visits.
 *
 * Held like the basemap and for the same reason: it is a setting rather than a
 * step in anything, and being put back into a mode you deliberately left is the
 * kind of small insult a page reload should not be able to deliver.
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
