import { describe, expect, it } from "vitest";
import type { Coord } from "@/lib/models/geo";
import { walkOrder, type WalkSegment } from "./walk";

/**
 * A few blocks of a fictional grid, far enough apart that the headings are
 * unambiguous: 0.002 of longitude is about 150 m here, 0.002 of latitude
 * about 220 m.
 */
const AT: Record<string, Coord> = {
  nA: [-122.4, 47.6],
  nB: [-122.398, 47.6],
  nC: [-122.396, 47.6],
  nD: [-122.394, 47.6],
  /** Due north of nB, so the turn onto it is a square one. */
  nNorth: [-122.398, 47.602],
  /** Another neighbourhood entirely, about 8 km east. */
  nFarA: [-122.3, 47.6],
  nFarB: [-122.298, 47.6],
};

function seg(id: string, from: string, to: string): WalkSegment {
  return { id, from, to, points: [AT[from], AT[to]] };
}

describe("walkOrder", () => {
  it("follows a chain from its dead end", () => {
    const order = walkOrder([
      seg("s2", "nB", "nC"),
      seg("s3", "nC", "nD"),
      seg("s1", "nA", "nB"),
    ]);
    expect(order).toEqual(["s1", "s2", "s3"]);
  });

  it("carries straight on through a junction rather than taking the turning", () => {
    // The branch sorts first by id, so id order alone would take it. Going
    // straight is what has to win here, or the walk leaves the road at every
    // junction — which is the whole reason this is not a plain search.
    const order = walkOrder([
      seg("sMainA", "nA", "nB"),
      seg("sBranch", "nB", "nNorth"),
      seg("sMainB", "nB", "nC"),
    ]);
    expect(order).toEqual(["sMainA", "sMainB", "sBranch"]);
  });

  it("comes back for the turning once the road runs out", () => {
    const order = walkOrder([
      seg("sMainA", "nA", "nB"),
      seg("sBranch", "nB", "nNorth"),
      seg("sMainB", "nB", "nC"),
      seg("sMainC", "nC", "nD"),
    ]);
    expect(order).toEqual(["sMainA", "sMainB", "sMainC", "sBranch"]);
  });

  it("restarts at the nearest unvisited segment, not the furthest", () => {
    // Two islands left over when the first chain ends at nC. The near one is
    // a few hundred meters away and the far one is eight kilometers; a stack
    // would hand back whichever was pushed last.
    const order = walkOrder([
      seg("s1", "nA", "nB"),
      seg("s2", "nB", "nC"),
      seg("sFar", "nFarA", "nFarB"),
      seg("sNear", "nD", "nNorth"),
    ]);
    expect(order).toEqual(["s1", "s2", "sNear", "sFar"]);
  });

  it("visits every segment exactly once", () => {
    const segments = [
      seg("s1", "nA", "nB"),
      seg("s2", "nB", "nC"),
      seg("s3", "nC", "nD"),
      seg("s4", "nB", "nNorth"),
      seg("s5", "nFarA", "nFarB"),
    ];
    const order = walkOrder(segments);
    expect([...order].sort()).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("walks the same way twice, so the list does not shuffle under an edit", () => {
    const segments = [
      seg("s1", "nA", "nB"),
      seg("s2", "nB", "nC"),
      seg("s3", "nB", "nNorth"),
      seg("s4", "nFarA", "nFarB"),
    ];
    expect(walkOrder(segments)).toEqual(walkOrder([...segments].reverse()));
  });

  it("still orders segments whose geometry has not loaded", () => {
    // The admin walks the list while the geometry files are still arriving,
    // so a segment with no points must not drop out of the order.
    const order = walkOrder([
      { id: "s2", from: "nB", to: "nC", points: [] },
      { id: "s1", from: "nA", to: "nB", points: [] },
    ]);
    expect([...order].sort()).toEqual(["s1", "s2"]);
  });

  it("has nothing to walk in an empty graph", () => {
    expect(walkOrder([])).toEqual([]);
  });
});
