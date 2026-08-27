/**
 * src/db/graph.json + src/db/geometry/*.json → public/*.geojson
 *
 * The compile step between the authoring format (split, diffable, no derived
 * values) and the runtime format (one flat FeatureCollection Mapbox can style
 * directly). Every derived number in the app is computed exactly here, once.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateGraph } from "../src/lib/db/graph-file";
import { connectedComponents } from "../src/lib/graph/adjacency";
import { buildGraphGeoJson, buildPinsGeoJson } from "../src/lib/graph/geojson";
import type { ElevCoord } from "../src/lib/models/geo";
import type { GraphFile, SegmentId } from "../src/lib/models/graph";

const GRAPH_FILE = path.resolve("src/db/graph.json");
const GEOMETRY_DIR = path.resolve("src/db/geometry");
const OUT_DIR = path.resolve("public");

async function loadGeometry(
  ids: SegmentId[],
): Promise<Map<SegmentId, ElevCoord[]>> {
  const geometry = new Map<SegmentId, ElevCoord[]>();
  if (!existsSync(GEOMETRY_DIR)) return geometry;

  const onDisk = new Set(
    (await readdir(GEOMETRY_DIR))
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.basename(f, ".json")),
  );

  for (const id of ids) {
    if (!onDisk.has(id)) continue;
    const raw = await readFile(path.join(GEOMETRY_DIR, `${id}.json`), "utf8");
    geometry.set(id, JSON.parse(raw) as ElevCoord[]);
  }

  // A geometry file with no segment referencing it is dead weight in the repo,
  // and usually means a segment was deleted without cleaning up after it.
  for (const id of onDisk) {
    if (!ids.includes(id)) {
      console.warn(`  ! geometry/${id}.json has no matching segment`);
    }
  }

  return geometry;
}

async function main() {
  const graph = JSON.parse(await readFile(GRAPH_FILE, "utf8")) as GraphFile;

  const problems = validateGraph(graph);
  for (const problem of problems) {
    console[problem.level === "error" ? "error" : "warn"](
      `  ${problem.level === "error" ? "✗" : "!"} ${problem.message}`,
    );
  }
  if (problems.some((p) => p.level === "error")) {
    throw new Error("Graph has errors — refusing to build");
  }

  const geometry = await loadGeometry(graph.segments.map((s) => s.id));
  const missing = graph.segments.filter((s) => !geometry.has(s.id));
  if (missing.length > 0) {
    throw new Error(
      `Missing geometry for: ${missing.map((s) => s.id).join(", ")}`,
    );
  }

  const graphGeoJson = buildGraphGeoJson(graph, geometry);
  const pinsGeoJson = buildPinsGeoJson(graph);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, "graph.geojson"),
    JSON.stringify(graphGeoJson),
  );
  await writeFile(
    path.join(OUT_DIR, "pins.geojson"),
    JSON.stringify(pinsGeoJson),
  );

  const meters = graphGeoJson.features.reduce(
    (sum: number, feature) => sum + Number(feature.properties?.meters ?? 0),
    0,
  );
  const components = connectedComponents(graph.segments);

  console.log(
    `\n${graph.segments.length} segments · ${graph.nodes.length} nodes · ` +
      `${graph.pins.length} pins · ${(meters / 1609.344).toFixed(1)} mi`,
  );
  if (components.length > 1) {
    console.log(
      `${components.length} disconnected components: ` +
        components.map((c) => `${c.length} nodes`).join(", "),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
