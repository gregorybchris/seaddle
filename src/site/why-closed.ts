import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph } from "./graph-data";
import { continuations, liveEnds, type Route } from "./route";

/**
 * Why a road cannot be picked right now.
 *
 * Three states on the map, and only one of them is clickable — but a beginner
 * reading a faded line has no way to tell whether it is faded because their
 * ride does not reach it, because they have already ridden it, or because of a
 * filter they set ten minutes ago. The map can say which; it just has to be
 * asked, and a tap is how someone asks.
 */
export type ClosedReason = "ridden" | "stranded" | "elsewhere";

/**
 * The reason, or null if the road is in fact pickable.
 *
 * "Ridden" is checked before the rest because it is the more precise answer:
 * the road at the end of a ride that has run out of road is both already
 * ridden and at a dead end, and being told it is already yours is what the
 * person tapping it needs to hear.
 */
export function whyClosed(
  route: Route,
  id: SegmentId,
  graph: SiteGraph,
): ClosedReason | null {
  const onward = continuations(route, graph);
  if (onward.has(id)) return null;
  if (route.steps.some((step) => step.segment === id)) return "ridden";
  return onward.size === 0 ? "stranded" : "elsewhere";
}

/** What the map says about it: a headline to read at a glance, then the rule. */
export type ClosedNotice = { headline: string; detail: string };

/**
 * The reason in words.
 *
 * Every one of them names the way out — undo, or pick a bright road — because
 * a message that only says no leaves the rider exactly where they were.
 */
export function closedNotice(reason: ClosedReason, route: Route): ClosedNotice {
  switch (reason) {
    case "ridden":
      return {
        headline: "Already in your ride",
        detail: "Undo back to this road to take a different turn from it.",
      };
    case "stranded":
      return {
        headline: "Nowhere left to go",
        detail:
          "No road continues from the end of your ride. Undo the last one to try another way.",
      };
    case "elsewhere":
      return {
        headline: "Oops! Can't add this segment",
        detail:
          // Both ends are live until a second road says which way the first
          // is being ridden. Pointing at the last segment while there are two
          // of them teaches a beginner a rule the map does not follow.
          liveEnds(route).length > 1
            ? "A route can't have breaks in it. Pick a segment directly next to the one you started on."
            : "A route can't have breaks in it. Pick a segment directly next to your last selected segment.",
      };
  }
}
