import { describe, expect, it } from "vitest";
import type { ElevCoord } from "@/lib/models/geo";
import { GRADE_WINDOW_METERS, gradeRuns, gradesAlong } from "./grade";

/** A line heading east at a fixed spacing, with the elevations given. */
function line(elevations: number[], spacingMeters = 20): ElevCoord[] {
  const perDegree = 111320 * Math.cos((47.68 * Math.PI) / 180);
  return elevations.map((ele, i) => [
    -122.33 + (i * spacingMeters) / perDegree,
    47.68,
    ele,
  ]);
}

describe("gradesAlong", () => {
  it("reads a constant slope as its true grade", () => {
    // Ten meters up every hundred along is ten percent, wherever you measure.
    const climb = gradesAlong(line([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]));
    for (const grade of climb) expect(grade).toBeCloseTo(10, 1);
  });

  it("calls flat ground flat", () => {
    expect(gradesAlong(line([5, 5, 5, 5, 5]))).toEqual([0, 0, 0, 0, 0]);
  });

  it("does not care which way the line is stored", () => {
    // A segment has no direction until someone rides it, so the same ground
    // has to read the same steepness from either end.
    const up = gradesAlong(line([0, 5, 10, 15, 20]));
    const down = [...gradesAlong(line([20, 15, 10, 5, 0]))].reverse();
    up.forEach((grade, i) => expect(down[i]).toBeCloseTo(grade, 6));
  });

  it("does not turn a meter of elevation noise into a wall", () => {
    // This is the whole reason for the window. Neighboring points a couple of
    // meters apart that disagree by a meter are noise, not a thirty percent
    // ramp, and measuring between them would say otherwise.
    // Long enough that the window sits inside it — over a stretch shorter than
    // the window there is nothing to average against and the noise is all
    // there is.
    const jittery = line(
      Array.from({ length: 80 }, (_, i) => i % 2),
      5,
    );
    for (const grade of gradesAlong(jittery)) expect(grade).toBeLessThan(3);
  });

  it("still reports a grade at the very ends of a segment", () => {
    // A segment cropped partway up a hill starts on the hill; a window that
    // needed both sides would open it at zero and understate the climb.
    const [first] = gradesAlong(line([0, 4, 8, 12, 16]));
    expect(first).toBeGreaterThan(5);
  });

  it("has no grade to report for a line too short to have one", () => {
    expect(gradesAlong([])).toEqual([]);
    expect(gradesAlong([[-122.33, 47.68, 10]])).toEqual([0]);
  });
});

describe("gradeRuns", () => {
  it("collapses even ground into a single run", () => {
    const runs = gradeRuns(line([0, 0, 0, 0, 0, 0]));
    expect(runs).toHaveLength(1);
    expect(runs[0].grade).toBe(0);
  });

  it("covers every piece of the line exactly once", () => {
    // Runs are drawn instead of the segment, so a gap between two of them is a
    // gap in the segment.
    const points = line([0, 1, 4, 9, 16, 20, 20, 20]);
    const runs = gradeRuns(points);
    const pieces = runs.reduce((n, run) => n + run.points.length - 1, 0);
    expect(pieces).toBe(points.length - 1);
    expect(runs[0].points[0]).toEqual(points[0]);
    expect(runs[runs.length - 1].points.at(-1)).toEqual(points.at(-1));
  });

  it("joins each run onto the next without a break", () => {
    const runs = gradeRuns(line([0, 0, 0, 5, 10, 15, 15, 15]));
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].points[0]).toEqual(runs[i - 1].points.at(-1));
    }
  });

  it("separates a hill from the flat it sits on", () => {
    const runs = gradeRuns(
      line(Array.from({ length: 12 }, (_, i) => (i < 6 ? 0 : (i - 5) * 4))),
    );
    expect(runs.length).toBeGreaterThan(1);
    expect(Math.max(...runs.map((r) => r.grade))).toBeGreaterThan(5);
    expect(Math.min(...runs.map((r) => r.grade))).toBe(0);
  });

  it("caps what it reports, so one cliff cannot own the whole ramp", () => {
    const cliff = gradeRuns(line([0, 20, 40, 60], 10));
    expect(Math.max(...cliff.map((r) => r.grade))).toBeLessThanOrEqual(12);
  });

  it("has nothing to draw for a line with no length", () => {
    expect(gradeRuns([])).toEqual([]);
    expect(gradeRuns([[-122.33, 47.68, 10]])).toEqual([]);
  });

  it("uses a window wide enough to outlast vertex spacing", () => {
    expect(GRADE_WINDOW_METERS).toBeGreaterThan(20);
  });
});
