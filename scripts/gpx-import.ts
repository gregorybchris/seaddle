/**
 * src-gpx/*.gpx → src/db/tracks/*.json
 *
 * Full resolution on purpose. These are the raw material the admin crops
 * segments out of, so throwing away detail here would cap the quality of every
 * segment forever. They are gitignored and dev-only; nothing in this directory
 * ever reaches the browser.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { densify } from "../src/lib/geo/polyline";
import type { ElevCoord } from "../src/lib/models/geo";
import { parseGpx } from "../src/lib/gpx/parse-gpx";
import { findRecordingGaps } from "../src/lib/gpx/recording-gaps";
import { MAX_TRACK_SPACING_METERS, type Track } from "../src/lib/models/track";

const SOURCE_DIR = path.resolve("src-gpx");
const OUT_DIR = path.resolve("src/db/tracks");

function slugify(filename: string): string {
  return path
    .basename(filename, ".gpx")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resample, and report where each original point landed.
 *
 * The mapping is what lets a gap found in the recorded points be expressed in
 * terms of the resampled ones without re-detecting it there.
 */
function densifyTracked(original: ElevCoord[]): {
  points: ElevCoord[];
  indexOf: number[];
} {
  const indexOf: number[] = [];
  const points: ElevCoord[] = [];
  for (let i = 0; i < original.length; i++) {
    if (i === 0) {
      indexOf.push(0);
      points.push(original[0]);
      continue;
    }
    const leg = densify(
      [original[i - 1], original[i]],
      MAX_TRACK_SPACING_METERS,
    );
    points.push(...leg.slice(1));
    indexOf.push(points.length - 1);
  }
  return { points, indexOf };
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    throw new Error(`No source directory at ${SOURCE_DIR}`);
  }
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(SOURCE_DIR))
    .filter((f) => f.toLowerCase().endsWith(".gpx"))
    .sort();

  const seen = new Map<string, string>();
  let totalPoints = 0;
  let totalGaps = 0;

  for (const file of files) {
    const slug = slugify(file);
    const clash = seen.get(slug);
    if (clash) {
      throw new Error(`"${file}" and "${clash}" both slugify to "${slug}"`);
    }
    seen.set(slug, file);

    const xml = await readFile(path.join(SOURCE_DIR, file), "utf8");
    const parsed = parseGpx(xml);
    // Gaps are found on the recorded points, then translated to where those
    // points end up once the ride is resampled.
    const rawGaps = findRecordingGaps(parsed.points, parsed.times);
    const { points, indexOf } = densifyTracked(parsed.points);
    const track: Track = {
      slug,
      name: parsed.name ?? slug,
      points,
      gaps: rawGaps.map(([from, to]) => [indexOf[from], indexOf[to]]),
    };
    if (track.points.length === 0) {
      console.warn(`  ! ${slug} has no track points — skipped`);
      continue;
    }
    await writeFile(
      path.join(OUT_DIR, `${slug}.json`),
      JSON.stringify(track) + "\n",
    );
    totalPoints += track.points.length;
    totalGaps += track.gaps.length;
    console.log(
      `  ${slug.padEnd(32)} ${String(parsed.points.length).padStart(5)} → ` +
        `${String(track.points.length).padStart(5)} pts` +
        `${track.gaps.length ? `  ${track.gaps.length} recording gap(s)` : ""}` +
        `  ${track.name}`,
    );
  }

  console.log(
    `\nImported ${seen.size} rides, ${totalPoints.toLocaleString()} points` +
      `${totalGaps ? `, ${totalGaps} recording gap(s) marked` : ""} → src/db/tracks/`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
