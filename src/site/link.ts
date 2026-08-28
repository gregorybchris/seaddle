import type { SegmentId } from "@/lib/models/graph";
import { decodeSegmentId, encodeSegmentId } from "./route";

/**
 * What the address bar says, which is also what a rider sends a friend.
 *
 * Two things worth putting in a link, and they are written by different hooks:
 * the ride by the route history, the road being read by the selection. So the
 * search string has one owner rather than two. The version where each hook
 * rebuilt the whole of it had the second writer quietly drop what the first had
 * just put there — a rider who stepped into explore mid-build lost the ride out
 * of their own URL, which is the one place this site keeps it.
 */
export type Link = {
  /** The ride, as the list of decisions that made it. Empty for no ride. */
  route: string;
  /** The road being read, while someone is reading one. */
  selected: SegmentId | null;
};

const ROUTE = "r";
const SEGMENT = "s";

/** What a search string carries, for whoever is asking what the link means. */
export function parseLink(search: string): Link {
  const params = new URLSearchParams(search);
  const named = params.get(SEGMENT);
  return {
    route: params.get(ROUTE) ?? "",
    // Spelled the way the roads in a ride are, because a link carrying both
    // reading two conventions at once is a link nobody would write by hand.
    selected: named ? decodeSegmentId(named) : null,
  };
}

/**
 * The same search string with only what is named changed.
 *
 * A patch rather than a whole link, because neither writer knows the other's
 * half. Leaving a key out means "not mine to touch"; naming it empty means the
 * thing is gone and the parameter should go with it, so a cleared route does
 * not leave `?r=` sitting in a URL someone is about to copy.
 */
export function linkSearch(search: string, patch: Partial<Link>): string {
  const params = new URLSearchParams(search);
  if (patch.route !== undefined) set(params, ROUTE, patch.route);
  if (patch.selected !== undefined) {
    set(params, SEGMENT, patch.selected ? encodeSegmentId(patch.selected) : "");
  }
  return params.toString();
}

function set(params: URLSearchParams, key: string, value: string): void {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function readLink(): Link {
  return parseLink(window.location.search);
}

/**
 * Rewrite the address bar, changing only what is named.
 *
 * The history state rides along untouched by default, because it is not ours to
 * lose: every entry carries the place on the route timeline that `restore`
 * reads back, and a selection replacing the URL without it would leave an entry
 * the back button could no longer make sense of.
 */
export function writeLink(
  patch: Partial<Link>,
  write: "push" | "replace",
  state: unknown = window.history.state,
): void {
  const search = linkSearch(window.location.search, patch);
  // A bare path when there is nothing left to say, rather than a trailing "?".
  const url = search ? `?${search}` : window.location.pathname;
  if (write === "push") window.history.pushState(state, "", url);
  else window.history.replaceState(state, "", url);
}
