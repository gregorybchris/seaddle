import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Connect, Plugin } from "vite";
import { compileGraph } from "../scripts/lib/compile";
import { serializeGraph } from "../src/lib/db/graph-file";
import type { GraphFile } from "../src/lib/models/graph";

const GRAPH_FILE = path.resolve("src/db/graph.json");
const GEOMETRY_DIR = path.resolve("src/db/geometry");
const TRACKS_DIR = path.resolve("src/db/tracks");

/**
 * Write endpoints for the admin page, available only while `vite dev` runs.
 *
 * The admin edits the repo directly and `git diff` is the review step, so there
 * is no database and no production API. This middleware exists purely so the
 * page can put a file on disk instead of making you copy JSON out of a
 * textarea. It is a dev server plugin, so none of it can reach production.
 */
export function adminApi(): Plugin {
  return {
    name: "seaddle-admin-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__admin", handle);
    },
  };
}

/**
 * Recompile what the site reads, shortly after the admin changes what it is
 * compiled from.
 *
 * Without this the two halves drift: the admin writes src/db and the site
 * fetches public/graph.geojson, and nothing in between notices. Debounced
 * because a review pass saves on every chip that gets clicked, and rebuilding
 * a hundred and fifty geometry files per click would be absurd.
 */
let pending: ReturnType<typeof setTimeout> | null = null;

function scheduleCompile(): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    compileGraph().catch((error: unknown) => {
      // A half-finished graph is a normal thing to have mid-edit, so this
      // reports and waits for the next save rather than failing the write
      // that has already happened.
      console.warn(
        `[seaddle] the site's map could not be rebuilt: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }, 500);
}

const handle: Connect.NextHandleFunction = (request, response, next) => {
  const url = (request.url ?? "").split("?")[0];
  const method = request.method ?? "GET";

  route(url, method, request)
    .then((body) => {
      if (body === undefined) return next();
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(body));
    })
    .catch((error: unknown) => {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
};

async function route(
  url: string,
  method: string,
  request: Connect.IncomingMessage,
): Promise<unknown> {
  if (url === "/tracks" && method === "GET") {
    return readTracks();
  }

  if (url === "/graph" && method === "GET") {
    return JSON.parse(await readFile(GRAPH_FILE, "utf8"));
  }

  if (url === "/graph" && method === "POST") {
    const graph = (await readBody(request)) as GraphFile;
    // Sorted and pretty-printed on the way out. The admin autosaves, so an
    // unstable key order would make every diff unreadable.
    await writeFile(GRAPH_FILE, serializeGraph(graph));
    scheduleCompile();
    return { ok: true, segments: graph.segments.length };
  }

  const geometryMatch = url.match(/^\/geometry\/([a-z0-9-]+)$/);
  if (geometryMatch) {
    const id = geometryMatch[1];
    const file = path.join(GEOMETRY_DIR, `${id}.json`);
    if (method === "PUT") {
      const points = await readBody(request);
      await mkdir(GEOMETRY_DIR, { recursive: true });
      await writeFile(file, JSON.stringify(points) + "\n");
      scheduleCompile();
      return { ok: true, id };
    }
    if (method === "DELETE") {
      if (existsSync(file)) await unlink(file);
      scheduleCompile();
      return { ok: true, id };
    }
    if (method === "GET") {
      return JSON.parse(await readFile(file, "utf8"));
    }
  }

  return undefined;
}

/**
 * Every source ride in one response.
 *
 * The admin needs all of them at once — the heatmap draws them and the
 * candidate finder searches them — and on localhost this is a single ~2 MB
 * request. Splitting it into 21 would just be 21 round trips to the same disk.
 */
async function readTracks(): Promise<unknown[]> {
  if (!existsSync(TRACKS_DIR)) {
    throw new Error(
      "No tracks found. Run `pnpm gpx:import` to parse src-gpx first.",
    );
  }
  const files = (await readdir(TRACKS_DIR)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files
      .sort()
      .map(async (file) =>
        JSON.parse(await readFile(path.join(TRACKS_DIR, file), "utf8")),
      ),
  );
}

function readBody(request: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
