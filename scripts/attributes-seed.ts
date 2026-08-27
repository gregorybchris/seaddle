/**
 * Steepness for every segment, read off the terrain.
 *
 * Steepness is not a matter of opinion — the geometry already knows how much a
 * segment climbs — so it is seeded rather than reviewed by hand. It is also
 * undirected: one value describing the segment however it is ridden, taking
 * whichever direction climbs more. A road that is a wall going up and a coast
 * coming down is a hilly road, and calling it flat because you happened to
 * store the downhill direction first was the trap the old two-sided field kept
 * walking into.
 *
 * Protection is seeded too, but only as a placeholder: nothing in the data
 * implies it, and it stays uniform until someone rides these roads and says.
 *
 * Nothing here sets `reviewed`, so the queue still counts only what a person
 * has actually looked at, and no value here can pass for one someone chose.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deriveSegment } from "../src/lib/graph/derive";
import { serializeGraph } from "../src/lib/db/graph-file";
import type { ElevCoord } from "../src/lib/models/geo";
import type { GraphFile, Steepness } from "../src/lib/models/graph";

const GRAPH_FILE = path.resolve("src/db/graph.json");
const GEOMETRY_DIR = path.resolve("src/db/geometry");

/**
 * Where a climb stops being incidental and starts being one you remember.
 *
 * Two conditions, not one, because either alone gets it wrong. Grade alone
 * calls s077 steep — seventy meters of connector at ten percent, seven meters
 * of climbing, over before you have changed gear. Total climb alone condemns a
 * long gentle trail for gaining the same height across five kilometers you
 * would never feel. A hill has to be steep *and* go on long enough to cost
 * something, so both have to clear the bar.
 *
 * Averaged over the whole segment, which is the honest limit of this: a
 * segment that is flat on average with one wall in the middle reads as flat.
 * That is exactly the case a person has to fix by hand.
 */
const HILLY = { grade: 1.5, gain: 10 };
const STEEP = { grade: 3, gain: 25 };

function steepnessFor(climbMeters: number, meters: number): Steepness {
  if (meters < 1) return "flat";
  const grade = (climbMeters / meters) * 100;
  if (grade >= STEEP.grade && climbMeters >= STEEP.gain) return "steep";
  if (grade >= HILLY.grade && climbMeters >= HILLY.gain) return "hilly";
  return "flat";
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

  const tally: Record<Steepness, number> = { flat: 0, hilly: 0, steep: 0 };
  const missing: string[] = [];

  const segments = graph.segments.map((segment) => {
    const points = geometry.get(segment.id);
    if (!points || points.length < 2) {
      missing.push(segment.id);
      return segment;
    }
    const { meters, gainForward, gainBackward } = deriveSegment(points);
    // The bigger of the two climbs: the same hill either way you meet it.
    const steepness = steepnessFor(Math.max(gainForward, gainBackward), meters);
    tally[steepness]++;
    return { ...segment, steepness, protection: "roadBikeLane" as const };
  });

  await writeFile(GRAPH_FILE, serializeGraph({ ...graph, segments }));

  console.log(`Seeded ${segments.length - missing.length} segment(s).`);
  console.log(
    `  steepness: flat ${tally.flat} · hilly ${tally.hilly} · steep ${tally.steep}`,
  );
  if (missing.length) {
    console.log(`  no geometry, untouched: ${missing.join(", ")}`);
  }
}

main();
