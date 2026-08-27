import { describe, expect, it } from "vitest";
import { humanize } from "./words";

describe("humanize", () => {
  it("splits camel case into words", () => {
    // The one that leaked into the interface.
    expect(humanize("laneQuality")).toBe("lane quality");
  });

  it("leaves a plain word alone", () => {
    expect(humanize("scenic")).toBe("scenic");
    expect(humanize("asphalt")).toBe("asphalt");
  });

  it("keeps everything lowercase, since these are choices and not headings", () => {
    expect(humanize("Surface")).toBe("surface");
    expect(humanize("recommendedDirection")).toBe("recommended direction");
  });

  it("splits on underscores and hyphens too", () => {
    expect(humanize("bike-shop")).toBe("bike shop");
    expect(humanize("lane_quality")).toBe("lane quality");
  });

  it("handles a run of capitals without shattering it", () => {
    expect(humanize("gpxFile")).toBe("gpx file");
  });

  it("gives back nothing for nothing", () => {
    expect(humanize("")).toBe("");
  });
});
