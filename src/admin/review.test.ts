import { describe, expect, it } from "vitest";
import { graph as emptyGraph, segment } from "@/lib/graph/test-fixtures";
import {
  applyAttributes,
  swapSegmentDirection,
  markUnreviewed,
  nextUnreviewed,
  reviewProgress,
  stepSegment,
} from "./review";

const THREE = emptyGraph({
  segments: [
    segment("s001", "nA", "nB"),
    segment("s002", "nB", "nC", { reviewed: true }),
    segment("s003", "nC", "nD"),
  ],
});

describe("applyAttributes", () => {
  it("sets what it was given", () => {
    const after = applyAttributes(THREE, ["s001"], {
      steepness: "rolling",
      surroundings: "beautiful",
    });
    expect(after.segments[0].steepness).toBe("rolling");
    expect(after.segments[0].surroundings).toBe("beautiful");
  });

  it("leaves everything it was not given alone", () => {
    // Bulk editing is the normal case: a whole trail shares its surroundings
    // without sharing a steepness, so one must not overwrite the rest.
    const reviewed = applyAttributes(THREE, ["s001"], {
      steepness: "steep",
      protection: "bikePath",
    });
    const after = applyAttributes(reviewed, ["s001"], {
      surroundings: "plain",
    });
    expect(after.segments[0].steepness).toBe("steep");
    expect(after.segments[0].protection).toBe("bikePath");
  });

  it("marks whatever it touches as reviewed", () => {
    // Deciding is the review, so there is no separate button to forget.
    const after = applyAttributes(THREE, ["s001"], {
      surroundings: "beautiful",
    });
    expect(after.segments[0].reviewed).toBe(true);
  });

  it("applies across every segment named", () => {
    const after = applyAttributes(THREE, ["s001", "s003"], {
      protection: "bikePath",
    });
    expect(after.segments.map((s) => s.protection)).toEqual([
      "bikePath",
      "unprotected",
      "bikePath",
    ]);
  });

  it("does nothing when nothing is selected", () => {
    expect(applyAttributes(THREE, [], { surroundings: "plain" })).toBe(THREE);
  });

  it("leaves the input alone", () => {
    applyAttributes(THREE, ["s001"], { surroundings: "beautiful" });
    expect(THREE.segments[0].surroundings).toBe("plain");
    expect(THREE.segments[0].reviewed).toBe(false);
  });
});

describe("markUnreviewed", () => {
  it("puts one back in the queue without changing what it says", () => {
    const after = markUnreviewed(THREE, "s002");
    expect(after.segments[1].reviewed).toBe(false);
    expect(after.segments[1].surroundings).toBe(THREE.segments[1].surroundings);
  });
});

describe("stepSegment", () => {
  it("walks forward and back through every segment", () => {
    expect(stepSegment(THREE.segments, "s001", 1)).toBe("s002");
    expect(stepSegment(THREE.segments, "s002", -1)).toBe("s001");
  });

  it("goes back to a segment that has just been reviewed", () => {
    // The whole reason to press previous: s002 is reviewed and so is not in
    // the unreviewed queue at all, but it is exactly the one being returned to.
    expect(THREE.segments[1].reviewed).toBe(true);
    expect(stepSegment(THREE.segments, "s003", -1)).toBe("s002");
  });

  it("wraps at both ends rather than stopping", () => {
    expect(stepSegment(THREE.segments, "s003", 1)).toBe("s001");
    expect(stepSegment(THREE.segments, "s001", -1)).toBe("s003");
  });

  it("starts at the beginning when nothing is in hand", () => {
    expect(stepSegment(THREE.segments, null, 1)).toBe("s001");
  });

  it("orders by id, so stepping and reading the list agree", () => {
    const shuffled = [THREE.segments[2], THREE.segments[0], THREE.segments[1]];
    expect(stepSegment(shuffled, "s001", 1)).toBe("s002");
  });

  it("has nowhere to go in an empty graph", () => {
    expect(stepSegment([], null, 1)).toBeNull();
  });

  it("falls back to the first when the segment it was given is gone", () => {
    expect(stepSegment(THREE.segments, "s999", 1)).toBe("s001");
  });
});

describe("nextUnreviewed", () => {
  it("starts at the first one still carrying defaults", () => {
    expect(nextUnreviewed(THREE.segments, null)).toBe("s001");
  });

  it("hands over the next one after finishing", () => {
    expect(nextUnreviewed(THREE.segments, "s001")).toBe("s003");
  });

  it("skips the ones already done", () => {
    expect(nextUnreviewed(THREE.segments, "s001")).not.toBe("s002");
  });

  it("wraps around at the end", () => {
    expect(nextUnreviewed(THREE.segments, "s003")).toBe("s001");
  });

  it("gives nothing once everything is reviewed", () => {
    const done = THREE.segments.map((s) => ({ ...s, reviewed: true }));
    expect(nextUnreviewed(done, null)).toBeNull();
  });
});

describe("reviewProgress", () => {
  it("counts what is done against the whole", () => {
    expect(reviewProgress(THREE.segments)).toEqual({ reviewed: 1, total: 3 });
  });
});

describe("swapSegmentDirection", () => {
  const one = emptyGraph({
    segments: [
      segment("s001", "nA", "nB", {
        steepness: "steep",
        source: { track: "ride", startIndex: 10, endIndex: 90 },
      }),
    ],
    pins: [
      {
        id: "p001",
        segment: "s001",
        kind: "drinkingWater",
        note: null,
        at: 0.25,
        coord: [-122.33, 47.68],
      },
    ],
  });

  it("turns the junctions around", () => {
    const after = swapSegmentDirection(one, "s001").segments[0];
    expect([after.from, after.to]).toEqual(["nB", "nA"]);
  });

  it("leaves steepness alone, which is the point of it being undirected", () => {
    // The hill is the same hill whichever way the segment is stored, so there
    // is nothing here left to turn around and get wrong.
    const after = swapSegmentDirection(one, "s001").segments[0];
    expect(after.steepness).toBe("steep");
  });

  it("turns the source indices around, so a rebuild redraws the new direction", () => {
    const after = swapSegmentDirection(one, "s001").segments[0];
    expect(after.source.startIndex).toBe(90);
    expect(after.source.endIndex).toBe(10);
    expect(after.source.track).toBe("ride");
  });

  it("moves pins to the same place measured from the other end", () => {
    expect(swapSegmentDirection(one, "s001").pins[0].at).toBeCloseTo(0.75, 9);
  });

  it("comes back to where it started when done twice", () => {
    const there = swapSegmentDirection(one, "s001");
    expect(swapSegmentDirection(there, "s001")).toEqual(one);
  });
});
