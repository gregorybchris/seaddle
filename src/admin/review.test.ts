import { describe, expect, it } from "vitest";
import { graph as emptyGraph, segment } from "@/lib/graph/test-fixtures";
import {
  applyAttributes,
  markUnreviewed,
  nextUnreviewed,
  reviewProgress,
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
      surface: "gravel",
      scenic: "high",
    });
    expect(after.segments[0].surface).toBe("gravel");
    expect(after.segments[0].scenic).toBe("high");
  });

  it("leaves everything it was not given alone", () => {
    // Bulk editing is the normal case: a whole trail shares a surface without
    // sharing a difficulty, so one attribute must not overwrite the rest.
    const reviewed = applyAttributes(THREE, ["s001"], {
      difficultyForward: "hard",
      laneQuality: "great",
    });
    const after = applyAttributes(reviewed, ["s001"], { surface: "dirt" });
    expect(after.segments[0].difficulty.forward).toBe("hard");
    expect(after.segments[0].laneQuality).toBe("great");
  });

  it("marks whatever it touches as reviewed", () => {
    // Deciding is the review, so there is no separate button to forget.
    const after = applyAttributes(THREE, ["s001"], { surface: "gravel" });
    expect(after.segments[0].reviewed).toBe(true);
  });

  it("applies across every segment named", () => {
    const after = applyAttributes(THREE, ["s001", "s003"], {
      laneQuality: "great",
    });
    expect(after.segments.map((s) => s.laneQuality)).toEqual([
      "great",
      "fair",
      "great",
    ]);
  });

  it("can clear a recommended direction, which is different from not saying", () => {
    const set = applyAttributes(THREE, ["s001"], {
      recommendedDirection: "forward",
    });
    expect(set.segments[0].recommendedDirection).toBe("forward");
    const cleared = applyAttributes(set, ["s001"], {
      recommendedDirection: null,
    });
    expect(cleared.segments[0].recommendedDirection).toBeNull();
    const untouched = applyAttributes(set, ["s001"], { surface: "dirt" });
    expect(untouched.segments[0].recommendedDirection).toBe("forward");
  });

  it("does nothing when nothing is selected", () => {
    expect(applyAttributes(THREE, [], { surface: "dirt" })).toBe(THREE);
  });

  it("leaves the input alone", () => {
    applyAttributes(THREE, ["s001"], { surface: "dirt" });
    expect(THREE.segments[0].surface).toBe("asphalt");
    expect(THREE.segments[0].reviewed).toBe(false);
  });
});

describe("markUnreviewed", () => {
  it("puts one back in the queue without changing what it says", () => {
    const after = markUnreviewed(THREE, "s002");
    expect(after.segments[1].reviewed).toBe(false);
    expect(after.segments[1].surface).toBe(THREE.segments[1].surface);
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
