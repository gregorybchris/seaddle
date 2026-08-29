import { describe, expect, it } from "vitest";
import type { SiteGraph } from "./graph-data";
import { siteGraph, siteSegment } from "./test-fixtures";
import { append, EMPTY_ROUTE, reachable, startRoute } from "./route";
import { closedNotice, groundNotice } from "./why-closed";

/**
 * Two islands, which is the only thing left that a pick cannot cross:
 *
 *   nA —s1— nB —s2— nC —s3— nD
 *            |
 *           s5
 *            |
 *           nF          nY —s4— nZ
 *
 * s4 is the far island. Everything else is one piece, so everything else is
 * pickable from anywhere in it however far away it is.
 */
const G: SiteGraph = siteGraph([
  siteSegment({ id: "s1", from: "nA", to: "nB" }),
  siteSegment({ id: "s2", from: "nB", to: "nC" }),
  siteSegment({ id: "s3", from: "nC", to: "nD" }),
  siteSegment({ id: "s5", from: "nB", to: "nF" }),
  siteSegment({ id: "s4", from: "nY", to: "nZ" }),
]);
const seg = (id: string) => G.segments.get(id)!;

/**
 * What the map's closed hit band would catch, which is what a notice is owed
 * about.
 *
 * The band is the complement of what `reachable` returns, so asking it here is
 * asking exactly what the layer filter asks. There is no `whyClosed` to test
 * against any more — a tap that lands in this band is unreachable by
 * construction, and the reason it gets is the only one there is.
 */
const closed = (route: Parameters<typeof reachable>[0], id: string) =>
  !reachable(route, G).has(id);

describe("what a pick is refused", () => {
  it("refuses nothing before a route starts", () => {
    // Every segment is a legal first pick, the far island included.
    expect(closed(EMPTY_ROUTE, "s4")).toBe(false);
    expect(closed(EMPTY_ROUTE, "s1")).toBe(false);
  });

  it("takes a segment next door", () => {
    expect(closed(startRoute(seg("s1")), "s2")).toBe(false);
    expect(closed(startRoute(seg("s1")), "s5")).toBe(false);
  });

  it("takes a segment further off, which now fills in", () => {
    expect(closed(startRoute(seg("s1")), "s3")).toBe(false);
  });

  it("takes a segment already ridden, which is picked again", () => {
    const route = append(startRoute(seg("s1")), seg("s5"), G);
    expect(closed(route, "s1")).toBe(false);
    expect(closed(route, "s5")).toBe(false);
  });

  it("takes a segment at a dead end, which a pick rides back out of", () => {
    const route = append(startRoute(seg("s1")), seg("s5"), G);
    expect(closed(route, "s3")).toBe(false);
  });

  it("leaves a segment on another island closed", () => {
    expect(closed(startRoute(seg("s1")), "s4")).toBe(true);
  });
});

describe("what the map says about it", () => {
  it("names starting over, since undo cannot cross water either", () => {
    const notice = closedNotice("unreachable");
    expect(notice.detail).toContain("Start over");
    expect(notice.detail).not.toContain("Undo");
  });

  it("sends a tap on bare ground to the button that clears the route", () => {
    expect(groundNotice(startRoute(seg("s1"))).detail).toContain("Start over");
  });

  it("invites a first pick instead when there is no route to clear", () => {
    const notice = groundNotice(EMPTY_ROUTE);
    expect(notice.detail).not.toContain("Start over");
    expect(notice.detail).toContain("start your route");
  });
});
