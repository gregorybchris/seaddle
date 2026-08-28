import { describe, expect, it } from "vitest";
import { isFiltering, NO_FILTERS, passes, type Filters } from "./filters";
import { siteSegment as segment } from "./test-fixtures";

const only = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over });

describe("passes", () => {
  it("lets everything through when nothing is set", () => {
    expect(passes(segment({ steepness: "steep" }), NO_FILTERS)).toBe(true);
    expect(passes(segment({ protection: "unprotected" }), NO_FILTERS)).toBe(
      true,
    );
  });

  it("keeps out what is steeper than asked for", () => {
    const steep = segment({ steepness: "steep" });
    expect(passes(steep, only({ steepest: "rolling" }))).toBe(false);
    expect(passes(steep, only({ steepest: "steep" }))).toBe(true);
  });

  it("treats bike lane and surroundings as floors rather than ceilings", () => {
    expect(
      passes(
        segment({ protection: "unprotected" }),
        only({ leastProtection: "bikeLane" }),
      ),
    ).toBe(false);
    expect(
      passes(
        segment({ protection: "bikePath" }),
        only({ leastProtection: "bikeLane" }),
      ),
    ).toBe(true);
    expect(
      passes(
        segment({ surroundings: "plain" }),
        only({ leastSurroundings: "scenic" }),
      ),
    ).toBe(false);
    expect(
      passes(
        segment({ surroundings: "scenic" }),
        only({ leastSurroundings: "scenic" }),
      ),
    ).toBe(true);
  });

  it("needs every bar cleared, not just one", () => {
    const rough = segment({ protection: "bikePath", steepness: "steep" });
    expect(
      passes(rough, only({ leastProtection: "bikePath", steepest: "flat" })),
    ).toBe(false);
  });
});

describe("isFiltering", () => {
  it("knows when nothing has been asked for", () => {
    expect(isFiltering(NO_FILTERS)).toBe(false);
  });

  it("notices any one bar being raised", () => {
    expect(isFiltering(only({ steepest: "flat" }))).toBe(true);
    expect(isFiltering(only({ leastProtection: "bikeLane" }))).toBe(true);
    expect(isFiltering(only({ leastSurroundings: "scenic" }))).toBe(true);
  });
});
