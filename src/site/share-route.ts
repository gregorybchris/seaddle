import { linkSearch } from "./link";

/** What became of a link once it was handed over. */
export type Handoff = "shared" | "copied" | "dismissed" | "failed";

/**
 * The address a rider sends to a friend.
 *
 * Built from the route rather than read off the address bar. What is in the bar
 * is whatever the last writer left there — a stale `?s=`, a `?utm_` picked up
 * on the way in — and a link going to somebody else should carry the route and
 * nothing besides. `linkSearch` writes it, because the spelling of a route in a
 * URL has one owner.
 */
export function routeLink(
  route: string,
  at: Pick<Location, "origin" | "pathname"> = window.location,
): string {
  const search = linkSearch("", { route });
  return `${at.origin}${at.pathname}${search ? `?${search}` : ""}`;
}

/**
 * Whether to open the device's own share sheet rather than reach for the
 * clipboard.
 *
 * Both the API and a coarse pointer, because desktop Safari and Edge have
 * `share` too — and there it throws a modal chooser over the map for something
 * a rider only wanted in their clipboard. On a phone the sheet is the shorter
 * path and the familiar one: it is how every other link on the device gets
 * passed along, and it reaches the apps a friend is actually in.
 */
export function sharesNatively(): boolean {
  return (
    typeof navigator.share === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * Hand the link over however this device hands links over.
 *
 * A share sheet that fails for any reason other than being dismissed falls
 * through to the clipboard, so a rider who asked for the link ends up with it
 * either way. Dismissing is not a failure — they changed their mind, and
 * telling them so would be reporting their own tap back at them.
 *
 * The clipboard has no fallback of its own: it is unavailable only outside a
 * secure context, which is the site over plain http on a LAN — dev, never
 * production — and the deprecated `execCommand` dance is not worth carrying in
 * the bundle for it.
 */
export async function shareRoute(url: string, title: string): Promise<Handoff> {
  if (sharesNatively()) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (error) {
      if (isDismissal(error)) return "dismissed";
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

function isDismissal(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
