import { describe, expect, it } from "vitest";
import type { SiteGraph } from "./graph-data";
import { siteGraph, siteSegment } from "./test-fixtures";
import { append, EMPTY_ROUTE, startRoute } from "./route";
import { closedNotice, groundNotice, whyClosed } from "./why-closed";

/**
 * A fork, a bend, and a dead end:
 *
 *   nA —s1— nB —s2— nC —s3— nD —s4— nE
 *            |
 *           s5
 *            |
 *           nF
 *
 * nB is the fork. nC and nD carry two segments each, so a route arriving at
 * either runs on by itself. nE is where the network stops.
 */
const G: SiteGraph = siteGraph([
  siteSegment({ id: "s1", from: "nA", to: "nB" }),
  siteSegment({ id: "s2", from: "nB", to: "nC" }),
  siteSegment({ id: "s3", from: "nC", to: "nD" }),
  siteSegment({ id: "s4", from: "nD", to: "nE" }),
  siteSegment({ id: "s5", from: "nB", to: "nF" }),
]);
const seg = (id: string) => G.segments.get(id)!;

describe("why a segment cannot be picked", () => {
  it("has no complaint before a route starts", () => {
    // Every segment is a legal first pick, so nothing is closed.
    expect(whyClosed(EMPTY_ROUTE, "s4", G)).toBeNull();
    expect(whyClosed(EMPTY_ROUTE, "s1", G)).toBeNull();
  });

  it("says nothing about a segment the route can actually reach", () => {
    expect(whyClosed(startRoute(seg("s1")), "s2", G)).toBeNull();
    expect(whyClosed(startRoute(seg("s1")), "s5", G)).toBeNull();
  });

  it("calls out a segment the route does not reach", () => {
    expect(whyClosed(startRoute(seg("s1")), "s3", G)).toBe("elsewhere");
  });

  it("calls out a segment already ridden", () => {
    const route = append(startRoute(seg("s1")), seg("s5"), G);
    expect(whyClosed(route, "s1", G)).toBe("ridden");
    expect(whyClosed(route, "s5", G)).toBe("ridden");
  });

  it("counts a segment the route ran on through as ridden", () => {
    // s3 was never clicked — the route took it by itself through the bend at
    // nC — but it is in the route all the same.
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(route.steps.map((step) => step.segment)).toContain("s3");
    expect(whyClosed(route, "s3", G)).toBe("ridden");
  });

  it("reports a dead end rather than a missing connection", () => {
    // The run-on carries this to nE, where nothing continues.
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(whyClosed(route, "s5", G)).toBe("stranded");
  });

  it("prefers 'already ridden' to the dead end it is sitting at", () => {
    const route = append(startRoute(seg("s1")), seg("s2"), G);
    expect(whyClosed(route, "s4", G)).toBe("ridden");
  });
});

describe("what the map says about it", () => {
  it("names both live ends while the direction is undecided", () => {
    const notice = closedNotice("elsewhere", startRoute(seg("s1")));
    expect(notice.detail).toContain("the one you started on");
  });

  it("names one once a second segment has picked a side", () => {
    const route = append(startRoute(seg("s1")), seg("s5"), G);
    const notice = closedNotice("elsewhere", route);
    expect(notice.detail).toContain("your last selected segment");
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
