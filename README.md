# Cycattle

A website for new cyclists in the Seattle area. Routes are not stored — a graph
of segments is, and a route is a path a rider builds through it by clicking.

The full design lives in [`specs/index.md`](specs/index.md).

## Getting started

```sh
pnpm install
cp .env.example .env.local   # add a Mapbox token restricted to localhost
pnpm gpx:import              # src-gpx/*.gpx → src/db/tracks/*.json
pnpm dev
```

`src-gpx/` is not in the repo. The source rides start and end at home, so they
stay on the machine that made them; put your own GPX files there before running
`gpx:import`. Tests use a synthetic fixture instead, so a fresh clone still
passes without them.

## How the data flows

```
src-gpx/*.gpx           source rides — LOCAL ONLY, gitignored, ~50k points
  │  pnpm gpx:import
  ▼
src/db/tracks/*.json    full resolution, gitignored, DEV ONLY — never bundled
  │  admin: place nodes, pick and crop the cleanest geometry between them
  ▼
src/db/graph.json       nodes + segment metadata + pins (authored, diffable)
src/db/geometry/*.json  one point array per segment (written once)
  │  pnpm graph:build
  ▼
public/graph.geojson    what the browser loads and Mapbox styles directly
public/pins.geojson
```

Derived values — length, elevation gain each way — are computed only in
`graph:build`. They are deliberately absent from the authoring files, because a
copy living beside the geometry it comes from goes stale the moment a segment is
re-cropped.

## Admin

`pnpm dev`, then <http://localhost:5173/admin>. It mounts only in development —
`import.meta.env.DEV` is a build-time literal, so the page and its API are not in
the production bundle at all. There is nothing to protect because there is
nothing out there.

Building the graph goes junctions first, segments second:

1. **Junctions.** Click where rides cross. The click snaps onto the nearest ride
   and onto an existing junction if one is within 15 m, so clicking the same
   intersection twice gives you one node rather than two that never connect.
2. **Segments.** Click two junctions. Every ride that runs between them is
   scored on directness, how close it passed, and how evenly its points are
   spaced, then ranked. Pick the cleanest geometry; it is cropped, thinned, and
   its ends pinned exactly to the junctions.

Edits autosave to `src/db/` through a dev-only Vite middleware. `git diff` is the
review step.

## Commands

| Command            | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Vite dev server (the admin page mounts in dev only) |
| `pnpm gpx:import`  | Parse `src-gpx/` into full-resolution track JSON    |
| `pnpm graph:build` | Compile the graph into the runtime GeoJSON          |
| `pnpm test`        | Vitest over the geometry, graph, and GPX logic      |
| `pnpm typecheck`   | `tsc --noEmit`                                      |
| `pnpm lint`        | ESLint                                              |
| `pnpm build`       | `graph:build`, typecheck, then a production bundle  |
