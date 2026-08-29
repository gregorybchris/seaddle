import { describe, expect, it } from "vitest";
import { graph as emptyGraph } from "@/lib/graph/test-fixtures";
import type { ElevCoord } from "@/lib/models/geo";
import { addPin, pinTarget, removePin, updatePin } from "./pins";
import { at, trackThrough } from "./test-tracks";

const LINE: ElevCoord[] = trackThrough("line", [at(0, 0), at(1000, 0)]).points;
const GEOMETRY = new Map([["s001", LINE]]);

describe("pinTarget", () => {
  it("answers which segment and how far along from one click", () => {
    const hit = pinTarget(GEOMETRY, at(500, 5))!;
    expect(hit.segment).toBe("s001");
    expect(hit.at).toBeCloseTo(0.5, 2);
  });

  it("ignores a click too far from any segment to be about one", () => {
    expect(pinTarget(GEOMETRY, at(500, 300))).toBeNull();
  });

  it("picks the nearer segment where two run close together", () => {
    const near = trackThrough("near", [at(0, 30), at(1000, 30)]).points;
    const both = new Map([
      ["s001", LINE],
      ["s002", near],
    ]);
    expect(pinTarget(both, at(500, 25))!.segment).toBe("s002");
  });
});

describe("addPin", () => {
  it("stores where it is on the segment and where the thing stands", () => {
    // A fountain sits in the park beside the trail, not on the center line.
    const beside = at(500, 12);
    const { pin } = addPin(emptyGraph(), "s001", 0.5, "drinkingWater", beside);
    expect(pin.at).toBe(0.5);
    expect(pin.coord[0]).toBeCloseTo(beside[0], 5);
    expect(pin.kind).toBe("drinkingWater");
  });

  it("numbers pins in sequence", () => {
    const first = addPin(
      emptyGraph(),
      "s001",
      0.2,
      "drinkingWater",
      at(200, 0),
    );
    const second = addPin(first.graph, "s001", 0.8, "restStop", at(800, 0));
    expect([first.pin.id, second.pin.id]).toEqual(["p001", "p002"]);
  });

  it("keeps a position on the segment even from a click past its end", () => {
    expect(
      addPin(emptyGraph(), "s001", 1.4, "viewpoint", at(0, 0)).pin.at,
    ).toBe(1);
  });
});

describe("updatePin", () => {
  const one = addPin(
    emptyGraph(),
    "s001",
    0.5,
    "drinkingWater",
    at(500, 0),
  ).graph;

  it("changes what it is", () => {
    expect(updatePin(one, "p001", { kind: "restroom" }).pins[0].kind).toBe(
      "restroom",
    );
  });

  it("collapses a blank note to null, so absent has one representation", () => {
    expect(updatePin(one, "p001", { note: "   " }).pins[0].note).toBeNull();
  });

  it("leaves what it was not given alone", () => {
    const noted = updatePin(one, "p001", { note: "by the shelter" });
    expect(updatePin(noted, "p001", { kind: "restStop" }).pins[0].note).toBe(
      "by the shelter",
    );
  });
});

describe("removePin", () => {
  it("takes one away", () => {
    const one = addPin(
      emptyGraph(),
      "s001",
      0.5,
      "drinkingWater",
      at(500, 0),
    ).graph;
    expect(removePin(one, "p001").pins).toEqual([]);
  });
});
