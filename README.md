# Seaddle

A website for new cyclists in the Seattle area. It holds a graph of real
Seattle roads — junctions, and the stretches of road between them — and a rider
builds a route by clicking their way outward from one segment to the next. Every
segment carries hand-reviewed attributes — how steep it is, how protected from
traffic, and what it rides past — so a beginner can see what a route is made of
before riding it.

Everything happens in the browser: the route lives in the URL, saved routes live
in `localStorage`, GPX export runs on the page, and the site deploys as static
files.

The full design lives in [`specs/index.md`](specs/index.md).

## Getting started

```sh
pnpm install                 # Node 22; also points git at .githooks
cp .env.example .env.local   # add a Mapbox token restricted to localhost
pnpm dev
```

The graph is committed, so a fresh clone runs the real site: `pnpm dev`
compiles it and serves <http://localhost:5173>.

## How the data flows

```
src/db/graph.json       junctions, segment attributes, and pins (authored, diffable)
src/db/geometry/*.json  one point array per segment
  │  pnpm graph:build     measure, validate, and merge into what the map draws
  ▼
public/graph.geojson    what the browser loads and Mapbox styles directly
public/pins.geojson
```

Currently 130 junctions, 179 segments, and 41 pins — 305 miles ridden, plus 8
across the water on the Bainbridge ferry.

The authoring files hold only what a person types. Every derived value — length,
elevation gain each way — is computed in `graph:build`, so it always matches the
geometry it came from even after a segment is re-cropped.

`public/og.png` and the favicons are committed rather than built on deploy,
because rasterising them needs `rsvg-convert` and ImageMagick. Run
`pnpm og:build` or `pnpm favicon:build` on a laptop when the mark or the graph
changes enough to matter, and commit what they write.

## The site

A rider clicks a segment to start, then clicks their way outward: each junction
offers whatever leaves it, and the route grows one choice at a time. Along the
way:

- **The route panel** totals the distance and the climbing, and breaks the
  route down by distance — four fifths of it in a bike lane, or the steep part
  a mile of it rather than a token stretch.
- **Color the map** by steepness, protection, surroundings, or grade — picked
  from four cards that each show the ramp they turn on.
- **Settings** hold the ground the map is drawn on, whether numbers read in
  miles or kilometers, and whether a pick moves the camera.
- **The route lives in the URL** (`/?r=s017,s042,s088`), so a link is the whole
  share mechanism and the site stays static.
- **Share** hands that link over the way the device does — the native share
  sheet on a phone, the clipboard on a desktop.
- **Undo is the back button.** Every move pushes a history entry, so back
  unbuilds the route; ⌘Z / ⌘⇧Z (and the control spellings) do the same from the
  keyboard.
- **Save** keeps a named route in `localStorage`.
- **Download** writes a GPX in the browser — the page already holds every point,
  so no round trip is involved.
- **Pins** — water, restrooms, viewpoints, rest stops, bike shops — are shown
  where they fall along the route.

## Admin

`pnpm dev`, then <http://localhost:5173/admin>. It mounts in development only —
`import.meta.env.DEV` is a build-time literal, so the page and its API stay out
of the production bundle entirely.

The graph is cut from GPX rides. Put your own in `src-gpx/` and run
`pnpm gpx:import`, which resamples every ride to a 15 m maximum vertex spacing
and filters its elevation: drawn routes (Mapometer) and GPS recordings (Strava)
both go in, and everything downstream treats them alike, because a sampled
terrain model is noisy in much the same way a GPS is.

Building the graph on top of those rides goes junctions first, segments second:

1. **Junctions.** Click where rides cross. The click snaps onto the nearest ride
   and onto an existing junction if one is within 15 m, so clicking the same
   intersection twice gives you one node rather than two that never connect.
2. **Segments.** Click two junctions. Every ride that runs between them is
   scored on directness, how close it passed, and how evenly its points are
   spaced, then ranked. Pick the cleanest geometry; it is cropped, thinned, and
   its ends pinned exactly to the junctions.

Edits autosave to `src/db/` through a dev-only Vite middleware, which recompiles
the GeoJSON shortly after each write — debounced, since a review pass saves on
every chip that gets clicked — so the site always serves the current graph.
`git diff` is the review step.

## Commands

| Command                 | What it does                                         |
| ----------------------- | ---------------------------------------------------- |
| `pnpm dev`              | Vite dev server (the admin page mounts in dev only)  |
| `pnpm build`            | `graph:build`, typecheck, then a production bundle   |
| `pnpm preview`          | Serve the built bundle                               |
| `pnpm gpx:import`       | Parse your GPX rides into full-resolution track JSON |
| `pnpm graph:build`      | Compile the graph into the runtime GeoJSON           |
| `pnpm geometry:rebuild` | Redraw every segment from the ride it was cut from   |
| `pnpm attributes:seed`  | Read steepness off the terrain for every segment     |
| `pnpm og:build`         | Redraw the social card from the mark and the graph   |
| `pnpm favicon:build`    | Rebuild the favicons from the mark component         |
| `pnpm test`             | Vitest over the geometry, graph, and GPX logic       |
| `pnpm typecheck`        | `tsc --noEmit`                                       |
| `pnpm lint`             | ESLint                                               |
| `pnpm format`           | Prettier over the repo (`format:check` to verify)    |

Tests run against `test-fixtures/sample-loop.gpx`, and `pnpm build` compiles the
committed graph, so both work on a fresh clone.

## Checks

CI runs `typecheck`, `lint`, `format:check`, `test`, and `build` on every push
and pull request. The pre-commit hook in `.githooks/` runs exactly the same set,
so a red build shows up locally rather than three minutes later on GitHub;
`pnpm install` points git at it.

## Deploying

Vercel, static. `vercel.json` rewrites every path to `index.html` because the
route is in the query string and the app is one page. Set `VITE_MAPBOX_TOKEN`
there, restricted by URL — it ships to the browser, so URL restriction is the
real protection — and optionally `VITE_MAP_STYLE` for a Mapbox Studio style;
both maps fall back to the stock light style without it.

Visits are counted by GoatCounter, loaded from `index.html`. It sets no cookies,
and a rider's data stays with the rider: the route they build is in their own
URL, and their saved routes are in their own browser.
