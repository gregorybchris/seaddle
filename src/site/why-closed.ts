import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph } from "./graph-data";
import { continuations, isEmpty, liveEnds, type Route } from "./route";

/**
 * Why a segment cannot be picked right now.
 *
 * Three states on the map, and only one of them is clickable — but a beginner
 * reading a faded line has no way to tell whether it is faded because their
 * route does not reach it, because they have already ridden it, or because of a
 * filter they set ten minutes ago. The map can say which; it just has to be
 * asked, and a tap is how someone asks.
 */
export type ClosedReason = "ridden" | "stranded" | "elsewhere";

/**
 * The reason, or null if the segment is in fact pickable.
 *
 * "Ridden" is checked before the rest because it is the more precise answer:
 * the segment at the end of a route that has run out of segment is both already
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
 * Every one of them names the way out — undo, or pick a bright segment —
 * because a message that only says no leaves the rider exactly where they were.
 */
export function closedNotice(reason: ClosedReason, route: Route): ClosedNotice {
  switch (reason) {
    case "ridden":
      return {
        headline: "Already in your route",
        detail: "Undo this segment to try a different route.",
      };
    case "stranded":
      return {
        headline: "Nowhere left to go",
        detail:
          "No segment continues from the end of your route. Undo the last one to try another way.",
      };
    case "elsewhere":
      return {
        headline: "Oops! Can't add this segment",
        detail:
          // Both ends are live until a second segment says which way the first
          // is being ridden. Pointing at the last segment while there are two
          // of them teaches a beginner a rule the map does not follow.
          liveEnds(route).length > 1
            ? "A route can't have breaks in it. Pick a segment directly next to the one you started on."
            : "A route can't have breaks in it. Pick a segment directly next to your last selected segment.",
      };
  }
}

/**
 * What the map says about a tap that landed on no segment at all.
 *
 * The ground between segments is the other way a build-mode tap can come to
 * nothing, and it needs an answer for the same reason a faded segment does: a
 * tap that changes nothing reads as a map that has stopped working. It is also
 * where a rider goes to undo everything — tapping the background is how most
 * maps drop what is selected, and here it does not, so the message points at
 * the button that does rather than leaving someone tapping harder.
 */
export function groundNotice(route: Route): ClosedNotice {
  return isEmpty(route)
    ? {
        headline: "Oops! That's not a segment",
        detail: "Only segments can be picked. Pick one to start your route.",
      }
    : {
        headline: "Oops! That's not a segment",
        detail:
          "Only segments can be picked. To clear your route, use the Start over button.",
      };
}
