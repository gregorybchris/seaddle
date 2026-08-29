/**
 * src/db/graph.json + src/db/geometry/*.json → public/*.geojson
 *
 * The step between the authoring format — split, diffable, no derived values —
 * and the runtime format Mapbox can style directly. Every derived number the
 * site shows is computed exactly here, once.
 */
import type { FeatureCollection, LineString } from "geojson";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateGraph, type GraphProblem } from "../../src/lib/db/graph-file";
import { connectedComponents } from "../../src/lib/graph/adjacency";
import {
  buildGraphGeoJson,
  buildPinsGeoJson,
} from "../../src/lib/graph/geojson";
import type { ElevCoord } from "../../src/lib/models/geo";
import type { GraphFile, SegmentId } from "../../src/lib/models/graph";

const GRAPH_FILE = path.resolve("src/db/graph.json");
const GEOMETRY_DIR = path.resolve("src/db/geometry");
const OUT_DIR = path.resolve("public");

export type CompileResult = {
  segments: number;
  nodes: number;
  pins: number;
  /** Ridden miles' worth of meters. A crossing is not ridden, so it is not in
   *  this — it is counted beside it, the way the site counts it. */
  meters: number;
  crossedMeters: number;
  components: number[];
  problems: GraphProblem[];
  orphanGeometry: string[];
};

export async function compileGraph(): Promise<CompileResult> {
  const graph = JSON.parse(await readFile(GRAPH_FILE, "utf8")) as GraphFile;

  const problems = validateGraph(graph);
  if (problems.some((problem) => problem.level === "error")) {
    throw new Error(
      problems
        .filter((problem) => problem.level === "error")
        .map((problem) => problem.message)
        .join("; "),
    );
  }

  const ids = graph.segments.map((segment) => segment.id);
  const { geometry, orphanGeometry } = await loadGeometry(ids);
  const missing = ids.filter((id) => !geometry.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing geometry for: ${missing.join(", ")}`);
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

  return {
    segments: graph.segments.length,
    nodes: graph.nodes.length,
    pins: graph.pins.length,
    meters: sumMeters(graphGeoJson, (crossing) => crossing === null),
    crossedMeters: sumMeters(graphGeoJson, (crossing) => crossing !== null),
    components: connectedComponents(graph.segments).map((c) => c.length),
    problems,
    orphanGeometry,
  };
}

function sumMeters(
  collection: FeatureCollection<LineString>,
  keep: (crossing: string | null) => boolean,
): number {
  return collection.features.reduce((sum, feature) => {
    const crossing = (feature.properties?.crossing ?? null) as string | null;
    return keep(crossing) ? sum + Number(feature.properties?.meters ?? 0) : sum;
  }, 0);
}

async function loadGeometry(ids: SegmentId[]): Promise<{
  geometry: Map<SegmentId, ElevCoord[]>;
  orphanGeometry: string[];
}> {
  const geometry = new Map<SegmentId, ElevCoord[]>();
  if (!existsSync(GEOMETRY_DIR)) return { geometry, orphanGeometry: [] };

  const onDisk = new Set(
    (await readdir(GEOMETRY_DIR))
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.basename(file, ".json")),
  );

  for (const id of ids) {
    if (!onDisk.has(id)) continue;
    geometry.set(
      id,
      JSON.parse(
        await readFile(path.join(GEOMETRY_DIR, `${id}.json`), "utf8"),
      ) as ElevCoord[],
    );
  }

  // A geometry file nothing references is dead weight, and usually means a
  // segment was deleted without cleaning up after it.
  const wanted = new Set(ids);
  return {
    geometry,
    orphanGeometry: [...onDisk].filter((id) => !wanted.has(id)),
  };
}
