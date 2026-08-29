import { describe, expect, it } from "vitest";
import { pinsAlong } from "./pins";

const PINS = [
  { id: "p1", segment: "s1", at: 0.2 },
  { id: "p2", segment: "s1", at: 0.8 },
  { id: "p3", segment: "s2", at: 0.5 },
];

describe("pinsAlong", () => {
  it("orders them the way they are ridden past", () => {
    expect(
      pinsAlong(PINS, [
        { segment: "s1", reversed: false },
        { segment: "s2", reversed: false },
      ]).map((pin) => pin.id),
    ).toEqual(["p1", "p2", "p3"]);
  });

  it("turns a segment's pins round when it is ridden backwards", () => {
    // The fountain a mile in from one end is a mile from the other end going
    // the other way, and a rider passes them in the opposite order.
    expect(
      pinsAlong(PINS, [{ segment: "s1", reversed: true }]).map((pin) => pin.id),
    ).toEqual(["p2", "p1"]);
  });

  it("ignores pins on segments the route does not use", () => {
    expect(
      pinsAlong(PINS, [{ segment: "s2", reversed: false }]).map((p) => p.id),
    ).toEqual(["p3"]);
  });

  it("has nothing to order for a route with no pins on it", () => {
    expect(pinsAlong([], [{ segment: "s1", reversed: false }])).toEqual([]);
  });
});
