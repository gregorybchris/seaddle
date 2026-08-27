import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { findRecordingGaps, insideGap, splitAtGaps } from "./recording-gaps";

/** Points a kilometre apart, so distance is never the reason a gap is missed. */
function line(count: number): ElevCoord[] {
  return Array.from({ length: count }, (_, i) => [
    -122.35 + i * 0.01,
    47.65,
    10,
  ]);
}

const MINUTE = 60_000;

describe("findRecordingGaps", () => {
  it("finds the stretch a stopped recorder left behind", () => {
    // Seattle to Bainbridge is thirteen kilometres and takes about forty
    // minutes, and a phone below deck records none of it.
    const times = [0, MINUTE, 45 * MINUTE, 46 * MINUTE];
    expect(findRecordingGaps(line(4), times)).toEqual([[1, 2]]);
  });

  it("ignores a normal recording interval", () => {
    const times = [0, 3000, 6000, 9000];
    expect(findRecordingGaps(line(4), times)).toEqual([]);
  });

  it("ignores a long stop where the rider did not move", () => {
    // An hour outside a coffee shop leaves a pause and no fabricated line.
    const still: ElevCoord[] = [
      [-122.35, 47.65, 10],
      [-122.35, 47.65, 10],
      [-122.3501, 47.65, 10],
    ];
    expect(findRecordingGaps(still, [0, 60 * MINUTE, 61 * MINUTE])).toEqual([]);
  });

  it("finds nothing in a route that was drawn rather than ridden", () => {
    // A drawn route's long straight legs are deliberate — the road really does
    // run straight between the two vertices someone clicked.
    expect(findRecordingGaps(line(5), [null, null, null, null, null])).toEqual(
      [],
    );
  });

  it("skips legs where only one end has a time", () => {
    expect(findRecordingGaps(line(3), [0, null, 90 * MINUTE])).toEqual([]);
  });

  it("finds several gaps in one ride", () => {
    const times = [0, 40 * MINUTE, 41 * MINUTE, 90 * MINUTE];
    expect(findRecordingGaps(line(4), times)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});

describe("insideGap", () => {
  it("covers the fabricated points and not the real ones at either end", () => {
    // The endpoints are places the recorder genuinely saw; only what import
    // invented between them is off limits.
    expect(insideGap([[10, 20]], 10)).toBe(false);
    expect(insideGap([[10, 20]], 15)).toBe(true);
    expect(insideGap([[10, 20]], 20)).toBe(false);
    expect(insideGap([], 15)).toBe(false);
  });
});

describe("splitAtGaps", () => {
  it("returns one piece when nothing was missed", () => {
    expect(splitAtGaps(line(5), [])).toHaveLength(1);
  });

  it("breaks the ride either side of the gap", () => {
    const pieces = splitAtGaps(line(6), [[2, 4]]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toHaveLength(3);
    expect(pieces[1]).toHaveLength(2);
  });

  it("drops a piece too short to draw", () => {
    expect(splitAtGaps(line(3), [[0, 2]])).toHaveLength(0);
  });

  it("handles an empty ride", () => {
    expect(splitAtGaps([], [])).toEqual([]);
  });
});
