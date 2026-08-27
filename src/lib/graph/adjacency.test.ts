import { describe, expect, it } from "vitest";
import {
  buildAdjacency,
  connectedComponents,
  continuationsFrom,
  otherEnd,
} from "./adjacency";
import { segment } from "./test-fixtures";

/** A → B → C, with a spur B → D. */
const SEGMENTS = [
  segment("s1", "nA", "nB"),
  segment("s2", "nB", "nC"),
  segment("s3", "nB", "nD"),
];

describe("buildAdjacency", () => {
  it("lists every segment touching a node", () => {
    const adjacency = buildAdjacency(SEGMENTS);
    expect(adjacency.get("nB")?.sort()).toEqual(["s1", "s2", "s3"]);
    expect(adjacency.get("nA")).toEqual(["s1"]);
  });

  it("counts a loop segment once", () => {
    const adjacency = buildAdjacency([segment("s1", "nA", "nA")]);
    expect(adjacency.get("nA")).toEqual(["s1"]);
  });
});

describe("continuationsFrom", () => {
  it("offers the other segments at the node", () => {
    const adjacency = buildAdjacency(SEGMENTS);
    expect(continuationsFrom(adjacency, "nB", "s1").sort()).toEqual([
      "s2",
      "s3",
    ]);
  });

  it("excludes the segment you arrived on, so a route cannot double back in place", () => {
    const adjacency = buildAdjacency(SEGMENTS);
    expect(continuationsFrom(adjacency, "nB", "s2")).not.toContain("s2");
  });

  it("offers everything when nothing has been ridden yet", () => {
    const adjacency = buildAdjacency(SEGMENTS);
    expect(continuationsFrom(adjacency, "nB", null)).toHaveLength(3);
  });

  it("is empty at a dead end", () => {
    const adjacency = buildAdjacency(SEGMENTS);
    expect(continuationsFrom(adjacency, "nC", "s2")).toEqual([]);
  });
});

describe("otherEnd", () => {
  it("walks a segment from either end", () => {
    expect(otherEnd(SEGMENTS[0], "nA")).toBe("nB");
    expect(otherEnd(SEGMENTS[0], "nB")).toBe("nA");
  });

  it("refuses a node the segment does not touch", () => {
    expect(() => otherEnd(SEGMENTS[0], "nZ")).toThrow(/does not touch/);
  });
});

describe("connectedComponents", () => {
  it("finds one island for a connected graph", () => {
    expect(connectedComponents(SEGMENTS)).toHaveLength(1);
    expect(connectedComponents(SEGMENTS)[0]).toHaveLength(4);
  });

  it("separates islands and sorts them largest first", () => {
    // Everett and Burien will not touch the Seattle network. That is a normal
    // condition to report, not an error to fail on.
    const islands = connectedComponents([
      ...SEGMENTS,
      segment("s4", "nX", "nY"),
    ]);
    expect(islands.map((c) => c.length)).toEqual([4, 2]);
  });

  it("is empty for a graph with no segments", () => {
    expect(connectedComponents([])).toEqual([]);
  });
});
