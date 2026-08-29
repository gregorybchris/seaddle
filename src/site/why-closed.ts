import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph } from "./graph-data";
import { isEmpty, reachable, type Route } from "./route";

/**
 * Why a segment cannot be picked right now.
 *
 * There used to be three answers here, because there used to be three states on
 * the map and only one of them was clickable. Now a pick fills in the way to
 * wherever it lands, so the segments that were faded for being out of reach, for
 * being already ridden, or for leaving the route with nowhere to go are all
 * simply picked.
 *
 * What is left is the network not being all one piece. The source rides cover
 * Everett, Edmonds and Burien as well as Seattle, and no amount of riding joins
 * those to a route started downtown. That is a normal condition rather than a
 * bug, and a beginner tapping one of those lines has no way to guess it — so it
 * is the one thing still drawn faded, and the one thing still owed an answer.
 */
export type ClosedReason = "unreachable";

/** The reason, or null if the segment is in fact pickable. */
export function whyClosed(
  route: Route,
  id: SegmentId,
  graph: SiteGraph,
): ClosedReason | null {
  if (isEmpty(route)) return null;
  return reachable(route, graph).has(id) ? null : "unreachable";
}

/** What the map says about it: a headline to read at a glance, then the rule. */
export type ClosedNotice = { headline: string; detail: string };

/**
 * The reason in words.
 *
 * It names the way out — starting over — because a message that only says no
 * leaves the rider exactly where they were. Undo is not offered: the islands
 * stay islands however far back a route is unwound, and pointing at a button
 * that cannot help is worse than pointing at nothing.
 */
export function closedNotice(reason: ClosedReason): ClosedNotice {
  switch (reason) {
    case "unreachable":
      return {
        headline: "No way to ride there",
        detail:
          "Nothing on this map joins that stretch to your route. Start over to build one there instead.",
      };
  }
}

/**
 * What the map says about a tap that landed on no segment at all.
 *
 * The ground between segments is now the only way a build-mode tap can come to
 * nothing on the near side of the water, and it needs an answer for the same
 * reason a faded segment does: a tap that changes nothing reads as a map that
 * has stopped working. It is also where a rider goes to undo everything —
 * tapping the background is how most maps drop what is selected, and here it
 * does not, so the message points at the button that does rather than leaving
 * someone tapping harder.
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
