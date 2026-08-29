import { cumulativeMeters } from "@/lib/geo/polyline";
import type { ElevCoord } from "@/lib/models/geo";

/**
 * How far apart the two points are that a grade is measured between.
 *
 * Not the gap between neighboring vertices, which is the obvious choice and a
 * bad one. Elevation in these files wobbles by a meter or two between adjacent
 * points — it is why `elevationGain` refuses to bank a rise under two meters —
 * and vertices can end up a few meters apart on a curve. Dividing noise by a
 * short distance manufactures grades of twenty and thirty percent on ground
 * that is flat, and the map fills up with red confetti.
 *
 * Sixty meters is long enough that the wobble is a rounding error against a
 * real hill and short enough to still show a pitch changing partway up one.
 */
export const GRADE_WINDOW_METERS = 60;

/**
 * The steepest the ramp bothers to distinguish, in percent.
 *
 * Past about twelve percent a segment is simply beyond a beginner on a loaded
 * bike, and spending color on the difference between that and fifteen would
 * take resolution away from the three-to-eight range where the interesting
 * decisions actually are.
 */
export const STEEPEST_GRADE = 12;

/** Grades within this of each other are drawn the same, so runs can merge. */
const GRADE_STEP = 0.25;

/**
 * Local grade at every vertex, unsigned, as a percentage.
 *
 * Unsigned because a segment has no direction until someone rides it: the same
 * line is a climb or a descent depending on which end you start from, and the
 * map is drawn before that is decided. What it can honestly say is how hard
 * the ground is tilted.
 */
export function gradesAlong(
  points: ElevCoord[],
  windowMeters = GRADE_WINDOW_METERS,
): number[] {
  if (points.length < 2) return points.map(() => 0);

  const along = cumulativeMeters(points);
  const half = windowMeters / 2;

  return points.map((_, i) => {
    // Walk out to half a window either side, stopping at the ends. Near an
    // end the window is short and one-sided rather than absent: a segment
    // that starts partway up a hill should say so at its first point.
    let lo = i;
    while (lo > 0 && along[i] - along[lo - 1] < half) lo--;
    let hi = i;
    while (hi < points.length - 1 && along[hi + 1] - along[i] < half) hi++;

    const run = along[hi] - along[lo];
    if (run < 1) return 0;
    return (Math.abs(points[hi][2] - points[lo][2]) / run) * 100;
  });
}

export type GradeRun = { points: ElevCoord[]; grade: number };

/**
 * A segment split into runs of even steepness.
 *
 * One feature per pair of vertices would work and would be nine thousand
 * features to draw the network once. Quantizing first means a mile of flat
 * trail is one feature instead of forty, which is most of them: the map is
 * mostly flat, and only the hills need the detail.
 */
export function gradeRuns(
  points: ElevCoord[],
  windowMeters = GRADE_WINDOW_METERS,
): GradeRun[] {
  if (points.length < 2) return [];

  const grades = gradesAlong(points, windowMeters);
  const runs: GradeRun[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    // The grade of a piece of line is the average of the two ends it lies
    // between, so a run of pieces steps up a hill instead of jumping at one.
    const grade = quantize((grades[i] + grades[i + 1]) / 2);
    const last = runs[runs.length - 1];
    if (last && last.grade === grade) {
      last.points.push(points[i + 1]);
    } else {
      runs.push({ points: [points[i], points[i + 1]], grade });
    }
  }
  return runs;
}

function quantize(grade: number): number {
  const capped = Math.min(grade, STEEPEST_GRADE);
  return Math.round(capped / GRADE_STEP) * GRADE_STEP;
}
