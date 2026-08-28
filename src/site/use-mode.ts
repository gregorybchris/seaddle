import { useState } from "react";
import { readStored, writeStored } from "@/lib/utilities/storage";
import { readLink } from "./link";
import type { Mode } from "./mode";

/** Kept in the browser, so a rider who prefers to read the map keeps reading it
 *  across a reload — the same as their choice of ground. */
const STORE_KEY = "seaddle:mode";

/**
 * The mode the link asks for, if it asks for one.
 *
 * Read before anything this browser remembers, and that order is the whole
 * point: a link is somebody handing over something specific to look at, while a
 * stored mode is a preference from whenever they were last here. The version
 * that consulted the link only when nothing was stored meant a friend who had
 * once pressed the binoculars was sent a ride and shown the wrong panel about
 * it, with no sign that the ride on the map had a distance and a GPX button
 * behind it.
 *
 * Which mode it asks for follows what it carries. A road named in the link is a
 * road somebody wanted read, so it wins over a ride carried alongside it — that
 * pairing is what a rider copies after stepping into explore mid-build, and the
 * road they tapped is the thing they were pointing at. A ride on its own opens
 * on the route panel, which is where its distance, its climb, its profile and
 * its GPX button are.
 *
 * Nothing here is written back to storage. Arriving on someone else's link is
 * not choosing a mode, and it should not quietly replace the one you chose.
 */
function fromLink(): Mode | null {
  const { route, selected } = readLink();
  if (selected) return "explore";
  return route ? "build" : null;
}

/** Only the two words this site writes count as a choice. Anything else — a
 *  missing value, a blocked store, whatever a future build might leave here —
 *  is nobody having chosen. */
function remembered(): Mode | null {
  const stored = readStored(STORE_KEY);
  return stored === "build" || stored === "explore" ? stored : null;
}

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
 */
function opening(): Mode {
  return fromLink() ?? remembered() ?? "explore";
}

/**
 * What a click on a road does, remembered between visits.
 *
 * Held like the basemap and for the same reason: it is a setting rather than a
 * step in anything, and being put back into a mode you deliberately left is the
 * kind of small insult a page reload should not be able to deliver. A link
 * outranks it, but only ever a link that carries something — a rider reloading
 * their own map with nothing named in it stays where they were.
 *
 * Only the mode. Which road was being read is not a setting either, but it is
 * not stored here: it is where the reader had got to, which is what the link is
 * for, and `use-selection` keeps it there.
 */
export function useMode(): [Mode, (mode: Mode) => void] {
  const [mode, setMode] = useState<Mode>(opening);

  function choose(next: Mode) {
    setMode(next);
    writeStored(STORE_KEY, next);
  }

  return [mode, choose];
}
