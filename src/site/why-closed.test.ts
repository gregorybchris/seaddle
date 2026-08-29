import { describe, expect, it } from "vitest";
import type { SiteGraph } from "./graph-data";
import { siteGraph, siteSegment } from "./test-fixtures";
import { append, EMPTY_ROUTE, startRoute } from "./route";
import { closedNotice, groundNotice, whyClosed } from "./why-closed";

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

describe("why a segment cannot be picked", () => {
  it("has no complaint before a route starts", () => {
    // Every segment is a legal first pick, the far island included.
    expect(whyClosed(EMPTY_ROUTE, "s4", G)).toBeNull();
    expect(whyClosed(EMPTY_ROUTE, "s1", G)).toBeNull();
  });

  it("says nothing about a segment next door", () => {
    expect(whyClosed(startRoute(seg("s1")), "s2", G)).toBeNull();
    expect(whyClosed(startRoute(seg("s1")), "s5", G)).toBeNull();
  });

  it("says nothing about a segment further off, which now fills in", () => {
    expect(whyClosed(startRoute(seg("s1")), "s3", G)).toBeNull();
  });

  it("says nothing about a segment already ridden, which is picked again", () => {
    const route = append(startRoute(seg("s1")), seg("s5"), G);
    expect(whyClosed(route, "s1", G)).toBeNull();
    expect(whyClosed(route, "s5", G)).toBeNull();
  });

  it("says nothing at a dead end, which a pick rides back out of", () => {
    const route = append(startRoute(seg("s1")), seg("s5"), G);
    expect(whyClosed(route, "s3", G)).toBeNull();
  });

  it("calls out a segment on another island", () => {
    expect(whyClosed(startRoute(seg("s1")), "s4", G)).toBe("unreachable");
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
