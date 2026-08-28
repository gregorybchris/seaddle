# Seaddle

A website for new cyclists in the Seattle area. Routes are not stored — a graph
of segments is, and a route is a path a rider builds through it by clicking.

The full design lives in [`specs/index.md`](specs/index.md).

## Getting started

```sh
pnpm install                 # Node 22; also points git at .githooks
cp .env.example .env.local   # add a Mapbox token restricted to localhost
pnpm gpx:import              # src-gpx/*.gpx → src/db/tracks/*.json
pnpm dev
```

`src-gpx/` is not in the repo. The source rides start and end at home, so they
stay on the machine that made them; put your own GPX files there before running
`gpx:import`. Tests use a synthetic fixture instead, so a fresh clone still
passes without them — and so does `pnpm build`, which compiles the committed
graph rather than the rides it was cut from.

Both drawn routes (Mapometer) and GPS recordings (Strava) go in. Nothing
downstream distinguishes them: import resamples every ride to the same maximum
vertex spacing, and elevation is filtered unconditionally because a sampled
terrain model is noisy in much the same way a GPS is.

## How the data flows

```
src-gpx/*.gpx           source rides — LOCAL ONLY, gitignored
                        43 files, ~109,000 points, ~2,000 km, 23 MB
  │  pnpm gpx:import     parse, then resample to a 15 m max vertex spacing
  ▼
src/db/tracks/*.json    full resolution, gitignored, DEV ONLY — never bundled
                        43 tracks, ~192,000 points after resampling
  │  admin: place nodes, pick and crop the cleanest geometry between them
  ▼
src/db/graph.json       nodes + segment metadata + pins (authored, diffable)
src/db/geometry/*.json  one point array per segment (redrawable from the source)
  │  pnpm graph:build
  ▼
public/graph.geojson    what the browser loads and Mapbox styles directly
public/pins.geojson
```

Currently 118 junctions, 158 segments, and 31 pins.

Derived values — length, elevation gain each way — are computed only in
`graph:build`. They are deliberately absent from the authoring files, because a
copy living beside the geometry it comes from goes stale the moment a segment is
re-cropped.

The GeoJSON is gitignored and rebuilt by `dev` and `build`. Two derived files
are committed anyway — `public/og.png` and the favicons — because rasterising
them needs `rsvg-convert` and ImageMagick, which are not on the deploy image.
Run `pnpm og:build` or `pnpm favicon:build` on a laptop when the mark or the
graph changes enough to matter, and commit what they write.

## The site

A rider clicks a segment to start, then clicks their way outward: each junction
offers whatever leaves it, and the route grows one choice at a time. Along the
way:

- **Filters** are thresholds, not checkboxes — nothing steeper than rolling, at
  least a bike lane, at least pleasant — because that is how a limit is actually
  held in someone's head.
- **The route lives in the URL** (`/?r=s017,s042,s088`), so a link is the
  whole share mechanism and there is nothing server-side to keep.
- **Undo is the back button.** Every move pushes a history entry, so back
  unbuilds the route; ⌘Z / ⌘⇧Z (and the control spellings) do the same from the
  keyboard.
- **Save** keeps a named route in `localStorage`.
- **Download** writes a GPX in the browser — the page already holds every point,
  so no round trip is involved.
- **Pins** — water, restrooms, viewpoints, rest stops, bike shops — are shown
  where they fall along the route.

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

Edits autosave to `src/db/` through a dev-only Vite middleware, which
recompiles the GeoJSON shortly after each write — debounced, since a review pass
saves on every chip that gets clicked — so the site never serves a stale graph.
`git diff` is the review step.

## Commands

| Command                 | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `pnpm dev`              | Vite dev server (the admin page mounts in dev only) |
| `pnpm build`            | `graph:build`, typecheck, then a production bundle  |
| `pnpm preview`          | Serve the built bundle                              |
| `pnpm gpx:import`       | Parse `src-gpx/` into full-resolution track JSON    |
| `pnpm graph:build`      | Compile the graph into the runtime GeoJSON          |
| `pnpm geometry:rebuild` | Redraw every segment from the ride it was cut from  |
| `pnpm attributes:seed`  | Read steepness off the terrain for every segment    |
| `pnpm og:build`         | Redraw the social card from the mark and the graph  |
| `pnpm favicon:build`    | Rebuild the favicons from the mark component        |
| `pnpm test`             | Vitest over the geometry, graph, and GPX logic      |
| `pnpm typecheck`        | `tsc --noEmit`                                      |
| `pnpm lint`             | ESLint                                              |
| `pnpm format`           | Prettier over the repo (`format:check` to verify)   |

## Checks

CI runs `typecheck`, `lint`, `format:check`, `test`, and `build` on every push
and pull request. The pre-commit hook in `.githooks/` runs exactly the same set,
so a red build shows up locally rather than three minutes later on GitHub;
`pnpm install` points git at it.

## Deploying

Vercel, static. `vercel.json` rewrites every path to `index.html` because the
route is in the query string and the app is one page. Set `VITE_MAPBOX_TOKEN`
there, restricted by URL — it ships to the browser, so URL restriction is the
only real protection — and optionally `VITE_MAP_STYLE` for a Mapbox Studio
style; without it both maps fall back to the stock light style.

Visits are counted by GoatCounter, loaded from `index.html`. No cookies, and
nothing about a rider leaves the page: the route they build is in their own URL
and their saved rides are in their own browser.
