/**
 * Rebuild every segment's geometry from the ride it was cut from.
 *
 * Each segment records the track and the point indices it came from, which
 * makes the drawn line a derived thing rather than a one-time capture. So the
 * simplification tolerance stays a decision that can be revisited: change it,
 * run this, and every segment is redrawn at the new fidelity without anyone
 * re-cutting anything by hand.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildGeometry,
  SIMPLIFY_TOLERANCE_METERS,
} from "../src/admin/extraction";
import { crop, projectOntoPolyline, snapEnds } from "../src/lib/geo/polyline";
import type { ElevCoord } from "../src/lib/models/geo";
import type { GraphFile } from "../src/lib/models/graph";
import type { Track } from "../src/lib/models/track";

const GRAPH_FILE = path.resolve("src/db/graph.json");
const GEOMETRY_DIR = path.resolve("src/db/geometry");
const TRACKS_DIR = path.resolve("src/db/tracks");

/** The furthest the redrawn line strays from the recorded one. */
function worstError(truth: ElevCoord[], drawn: ElevCoord[]): number {
  let worst = 0;
  for (const point of truth) {
    const away = projectOntoPolyline(drawn, [
      point[0],
      point[1],
    ]).distanceMeters;
    if (away > worst) worst = away;
  }
  return worst;
}

async function main() {
  if (!existsSync(TRACKS_DIR)) {
    throw new Error("No tracks found. Run `pnpm gpx:import` first.");
  }
  const graph = JSON.parse(await readFile(GRAPH_FILE, "utf8")) as GraphFile;
  const nodes = new Map(graph.nodes.map((node) => [node.id, node.coord]));
  const tracks = new Map<string, Track>();
  await mkdir(GEOMETRY_DIR, { recursive: true });

  let before = 0;
  let after = 0;
  let worst = 0;

  for (const segment of graph.segments) {
    const slug = segment.source.track;
    if (!tracks.has(slug)) {
      const file = path.join(TRACKS_DIR, `${slug}.json`);
      if (!existsSync(file)) {
        console.warn(`  ! ${segment.id}: no ride named ${slug} — left alone`);
        continue;
      }
      tracks.set(slug, JSON.parse(await readFile(file, "utf8")) as Track);
    }
    const from = nodes.get(segment.from);
    const to = nodes.get(segment.to);
    if (!from || !to) {
      console.warn(`  ! ${segment.id}: missing a junction — left alone`);
      continue;
    }

    const track = tracks.get(slug)!;
    const cropped = crop(
      track.points,
      segment.source.startIndex,
      segment.source.endIndex,
    );
    // The recorded line, endpoints pinned the same way, is what the redrawn
    // one is measured against.
    const source = snapEnds(cropped, from, to);
    const geometry = buildGeometry(cropped, from, to);

    const file = path.join(GEOMETRY_DIR, `${segment.id}.json`);
    const previous = existsSync(file)
      ? (JSON.parse(await readFile(file, "utf8")) as ElevCoord[])
      : [];
    await writeFile(file, JSON.stringify(geometry) + "\n");

    const error = worstError(source, geometry);
    worst = Math.max(worst, error);
    before += previous.length;
    after += geometry.length;
    console.log(
      `  ${segment.id.padEnd(6)} ${String(previous.length).padStart(4)} → ` +
        `${String(geometry.length).padStart(4)} pts   worst error ${error.toFixed(2)}m`,
    );
  }

  console.log(
    `\nRedrawn at ${SIMPLIFY_TOLERANCE_METERS}m tolerance: ` +
      `${before} → ${after} points, worst error ${worst.toFixed(2)}m`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
