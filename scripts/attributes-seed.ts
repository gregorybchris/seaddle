/**
 * Provisional attributes for segments nobody has reviewed yet.
 *
 * The map is only worth looking at if its lines differ from each other, and
 * until the review pass happens they otherwise all carry identical defaults.
 * Difficulty is the one attribute that does not need a human: the geometry
 * already knows how much a segment climbs, per direction, so this reads it off
 * the terrain rather than inventing it.
 *
 * Two rules keep this honest. It never touches a reviewed segment, so real
 * judgments are safe from a re-run. And it never sets `reviewed`, so the queue
 * still reports exactly how many segments a person has actually looked at, and
 * nothing here can be mistaken for something someone decided.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deriveSegment } from "../src/lib/graph/derive";
import { serializeGraph } from "../src/lib/db/graph-file";
import type { ElevCoord } from "../src/lib/models/geo";
import type { Difficulty, GraphFile } from "../src/lib/models/graph";

const GRAPH_FILE = path.resolve("src/db/graph.json");
const GEOMETRY_DIR = path.resolve("src/db/geometry");

/**
 * Where a climb stops being incidental and starts being one you remember.
 *
 * Two conditions, not one, because either alone gets it wrong. Grade alone
 * calls s077 hard — seventy meters of connector at ten percent, seven meters
 * of climbing, over before you have changed gear. Total climb alone calls a
 * long gentle trail hard for gaining the same height over five kilometers you
 * would never notice. A hill has to be steep *and* go on long enough to cost
 * something, so both have to clear the bar.
 *
 * Averaged over the whole segment, which is the honest limit of this: a
 * segment that is flat on average with one wall in the middle reads as easy.
 * That is exactly the case a person has to fix by hand, and why nothing here
 * marks itself reviewed.
 */
const MEDIUM = { grade: 1.5, gain: 10 };
const HARD = { grade: 3, gain: 25 };

function difficultyFor(gainMeters: number, meters: number): Difficulty {
  if (meters < 1) return "easy";
  const grade = (gainMeters / meters) * 100;
  if (grade >= HARD.grade && gainMeters >= HARD.gain) return "hard";
  if (grade >= MEDIUM.grade && gainMeters >= MEDIUM.gain) return "medium";
  return "easy";
}

async function main() {
  const graph = JSON.parse(await readFile(GRAPH_FILE, "utf8")) as GraphFile;
  const files = (await readdir(GEOMETRY_DIR)).filter((f) =>
    f.endsWith(".json"),
  );
  const geometry = new Map<string, ElevCoord[]>();
  for (const file of files) {
    geometry.set(
      path.basename(file, ".json"),
      JSON.parse(await readFile(path.join(GEOMETRY_DIR, file), "utf8")),
    );
  }

  const tally = { easy: 0, medium: 0, hard: 0 };
  let touched = 0;
  let skipped = 0;
  const missing: string[] = [];

  const segments = graph.segments.map((segment) => {
    if (segment.reviewed) {
      skipped++;
      return segment;
    }
    const points = geometry.get(segment.id);
    if (!points || points.length < 2) {
      missing.push(segment.id);
      return segment;
    }
    const { meters, gainForward, gainBackward } = deriveSegment(points);
    const forward = difficultyFor(gainForward, meters);
    const backward = difficultyFor(gainBackward, meters);
    tally[forward]++;
    touched++;
    return {
      ...segment,
      difficulty: { forward, backward },
      laneQuality: "good" as const,
    };
  });

  await writeFile(GRAPH_FILE, serializeGraph({ ...graph, segments }));

  const both = segments.filter(
    (s) => !s.reviewed && s.difficulty.forward === s.difficulty.backward,
  ).length;
  console.log(
    `Seeded ${touched} unreviewed segment(s); left ${skipped} reviewed one(s) alone.`,
  );
  console.log(
    `  forward difficulty: easy ${tally.easy} · medium ${tally.medium} · hard ${tally.hard}`,
  );
  console.log(`  same both ways: ${both}/${touched}`);
  if (missing.length)
    console.log(`  no geometry, untouched: ${missing.join(", ")}`);
}

main();
