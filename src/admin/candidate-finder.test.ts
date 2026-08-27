import { describe, expect, it } from "vitest";
import { haversineMeters } from "@/lib/geo/distance";
import {
  buildTrackIndex,
  findCandidates,
  findVisits,
} from "./candidate-finder";
import { at, trackThrough } from "./test-tracks";

const A = at(0, 0);
const B = at(500, 0);

describe("findVisits", () => {
  it("collapses a run of nearby points into one pass", () => {
    // At 15 m spacing a 25 m radius catches several points in a row; they are
    // one ride through the junction, not several.
    const track = trackThrough("straight", [at(-200, 0), at(200, 0)]);
    const visits = findVisits(buildTrackIndex([track]), A, 25);
    expect(visits).toHaveLength(1);
    expect(visits[0].track).toBe("straight");
    expect(visits[0].distanceMeters).toBeLessThan(15);
  });

  it("reports a second pass when a loop comes back around", () => {
    const loop = trackThrough("loop", [
      at(-200, 0),
      at(200, 0),
      at(200, 400),
      at(-200, 400),
      at(-200, 0),
      at(200, 0),
    ]);
    expect(findVisits(buildTrackIndex([loop]), A, 25)).toHaveLength(2);
  });

  it("finds nothing when no track comes near", () => {
    const track = trackThrough("far", [at(5000, 5000), at(5200, 5000)]);
    expect(findVisits(buildTrackIndex([track]), A, 25)).toEqual([]);
  });
});

describe("findCandidates", () => {
  it("offers a track that runs straight between the two junctions", () => {
    const track = trackThrough("direct", [at(-100, 0), at(600, 0)]);
    const candidates = findCandidates([track], buildTrackIndex([track]), A, B);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].detourRatio).toBeLessThan(1.1);
    expect(candidates[0].meters).toBeGreaterThan(490);
    expect(candidates[0].meters).toBeLessThan(520);
  });

  it("rejects a track that touches both junctions but wanders in between", () => {
    // The failure this whole scoring pass exists to prevent: passing near A and
    // near B does not make a two-mile detour a segment.
    const wanderer = trackThrough("wanderer", [
      at(0, 0),
      at(0, 2000),
      at(500, 2000),
      at(500, 0),
    ]);
    expect(
      findCandidates([wanderer], buildTrackIndex([wanderer]), A, B),
    ).toEqual([]);
  });

  it("ignores a track that only reaches one junction", () => {
    const track = trackThrough("half", [at(-100, 0), at(100, 0)]);
    expect(findCandidates([track], buildTrackIndex([track]), A, B)).toEqual([]);
  });

  it("orients geometry from → to even when the ride went the other way", () => {
    const backwards = trackThrough("backwards", [at(600, 0), at(-100, 0)]);
    const candidate = findCandidates(
      [backwards],
      buildTrackIndex([backwards]),
      A,
      B,
    )[0];
    const start: [number, number] = [
      candidate.points[0][0],
      candidate.points[0][1],
    ];
    expect(haversineMeters(start, A)).toBeLessThan(20);
    expect(candidate.startIndex).toBeGreaterThan(candidate.endIndex);
  });

  it("keeps a loop's other pass as an alternate, shortest first", () => {
    const loop = trackThrough("loop", [
      at(0, 0),
      at(500, 0),
      at(500, 600),
      at(0, 600),
      at(0, 0),
      at(0, -300),
    ]);
    const candidate = findCandidates([loop], buildTrackIndex([loop]), A, B, {
      maxDetourRatio: 5,
    })[0];
    expect(candidate.alternates).toHaveLength(1);
    expect(candidate.meters).toBeLessThan(candidate.alternates[0].meters);
  });

  it("ranks the more direct track above the surroundings route", () => {
    const direct = trackThrough("direct", [at(-100, 0), at(600, 0)]);
    const bendy = trackThrough("bendy", [at(0, 0), at(250, 400), at(500, 0)]);
    const tracks = [bendy, direct];
    const candidates = findCandidates(tracks, buildTrackIndex(tracks), A, B);
    expect(candidates.map((c) => c.track)).toEqual(["direct", "bendy"]);
  });

  it("prefers the track that passed closer to the junctions", () => {
    // Same shape, but one is drawn a few meters off the intersection.
    const onIt = trackThrough("on-it", [at(-100, 0), at(600, 0)]);
    const offBy = trackThrough("off-by", [at(-100, 18), at(600, 18)]);
    const tracks = [offBy, onIt];
    const candidates = findCandidates(tracks, buildTrackIndex(tracks), A, B);
    expect(candidates[0].track).toBe("on-it");
    expect(candidates[0].endpointMeters).toBeLessThan(
      candidates[1].endpointMeters,
    );
  });

  it("reports climbing in both directions", () => {
    const track = trackThrough("hill", [at(-100, 0), at(600, 0)]);
    track.points = track.points.map((p, i) => [p[0], p[1], i * 2]);
    const candidate = findCandidates(
      [track],
      buildTrackIndex([track]),
      A,
      B,
    )[0];
    expect(candidate.gainForward).toBeGreaterThan(0);
    expect(candidate.gainBackward).toBe(0);
  });

  it("returns nothing when both junctions are the same place", () => {
    const track = trackThrough("direct", [at(-100, 0), at(600, 0)]);
    expect(findCandidates([track], buildTrackIndex([track]), A, A)).toEqual([]);
  });

  it("honours a widened detour allowance", () => {
    const bendy = trackThrough("bendy", [at(0, 0), at(250, 900), at(500, 0)]);
    const index = buildTrackIndex([bendy]);
    expect(findCandidates([bendy], index, A, B, { maxDetourRatio: 2 })).toEqual(
      [],
    );
    expect(
      findCandidates([bendy], index, A, B, { maxDetourRatio: 8 }),
    ).toHaveLength(1);
  });
});

describe("ordering", () => {
  function dated(slug: string, recordedAt: string | null) {
    return { ...trackThrough(slug, [at(-100, 0), at(600, 0)]), recordedAt };
  }

  it("puts the most recent ride first", () => {
    // A road resurfaced or a trail rerouted since an older ride was recorded,
    // so the newest pass is the one that reflects what is there now.
    const tracks = [
      dated("older", "2025-06-04T18:00:00Z"),
      dated("newest", "2026-08-06T18:00:00Z"),
      dated("middle", "2026-05-09T18:00:00Z"),
    ];
    const found = findCandidates(tracks, buildTrackIndex(tracks), A, B);
    expect(found.map((c) => c.track)).toEqual(["newest", "middle", "older"]);
  });

  it("sorts undated drawn routes last, cleanest of them first", () => {
    const tracks = [
      {
        ...trackThrough("bendy", [at(0, 0), at(250, 300), at(500, 0)]),
        recordedAt: null,
      },
      dated("recorded", "2026-01-01T18:00:00Z"),
      dated("drawn-direct", null),
    ];
    const found = findCandidates(tracks, buildTrackIndex(tracks), A, B, {
      maxDetourRatio: 5,
    });
    expect(found[0].track).toBe("recorded");
    expect(found[1].track).toBe("drawn-direct");
    expect(found[2].track).toBe("bendy");
  });

  it("carries the ride date onto the candidate", () => {
    const tracks = [dated("ride", "2026-07-06T18:00:00Z")];
    const found = findCandidates(tracks, buildTrackIndex(tracks), A, B);
    expect(found[0].trackDate).toBe("2026-07-06T18:00:00Z");
  });

  it("still keeps a ride's own passes ordered by how cleanly they run", () => {
    const loop = {
      ...trackThrough("loop", [
        at(0, 0),
        at(500, 0),
        at(500, 600),
        at(0, 600),
        at(0, 0),
        at(0, -300),
      ]),
      recordedAt: "2026-07-06T18:00:00Z",
    };
    const found = findCandidates([loop], buildTrackIndex([loop]), A, B, {
      maxDetourRatio: 5,
    })[0];
    expect(found.meters).toBeLessThan(found.alternates[0].meters);
  });
});
