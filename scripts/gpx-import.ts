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
import { parseGpx } from "../src/lib/gpx/parse-gpx";
import type { Track } from "../src/lib/models/track";

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

  for (const file of files) {
    const slug = slugify(file);
    const clash = seen.get(slug);
    if (clash) {
      throw new Error(`"${file}" and "${clash}" both slugify to "${slug}"`);
    }
    seen.set(slug, file);

    const xml = await readFile(path.join(SOURCE_DIR, file), "utf8");
    const parsed = parseGpx(xml);
    const track: Track = {
      slug,
      name: parsed.name ?? slug,
      points: parsed.points,
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
    console.log(
      `  ${slug.padEnd(36)} ${String(track.points.length).padStart(6)} pts  ${track.name}`,
    );
  }

  console.log(
    `\nImported ${seen.size} tracks, ${totalPoints.toLocaleString()} points → src/db/tracks/`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
