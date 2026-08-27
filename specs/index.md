# Seaddle

Seaddle is a website for new cyclists in the Seattle area. It helps people new to the sport
discover routes that suit them.

The core problem: every route site makes you pick a start and an end. But a route's usefulness
depends entirely on where you live, and a beginner doesn't know which roads are pleasant and
which will scare them off the sport. Seaddle answers "what's a good ride from around here?"
instead of "here is someone else's 32-mile loop."

## The central idea

Routes are not stored. A **graph of segments** is stored, and a route is a path the user builds
through it by clicking. Each segment carries the metadata a new cyclist actually cares about —
how hard it is, how safe the bike lane is, how pretty it is, what it's paved with — so a route's
character is the sum of its parts rather than an opaque line on a map.

---

## 1. Source data

`src-gpx/` holds 21 GPX files (~50,000 track points, 8.7 MB raw), exported from Mapometer.
Coverage spans Seattle proper, the Eastside (Mercer Island, Sammamish, May Valley), and outlying
tracks in Everett, Edmonds, and Burien.

**The sources are mixed, and nothing downstream may assume otherwise.** Twelve rides are drawn in
Mapometer and snapped to roads; nine are recorded by Strava off a GPS. Measured across both:

| | vertex spacing | spacing variability | 6 m simplify loss | raw ↑ vs filtered ↑ |
| --- | --- | --- | --- | --- |
| Strava (9) | 15–20 m | cv 0.71–1.96 | 0.33–0.58% | 1021 m → 679 m |
| Mapometer (12) | 14–156 m | cv 1.06–3.07 | 0.06–0.83% | 723 m → 546 m |

Two of those numbers are the opposite of the intuition. **Drawn routes are the unevenly spaced
ones** — Mapometer emits a vertex only where the road turns, while Strava samples on a timer — so
the sparsest geometry in the set is hand-drawn, not recorded. And **drawn elevation is noisy too**,
because Mapometer samples a terrain model rather than measuring; filtering is not a GPS
accommodation, it is unconditional.

**A recorder that stops leaves a line that is not a road.** A ride onto a ferry keeps its GPS
below deck for the crossing, and the export joins the two ends with one straight line: measured
here, 13 km of open water covered twice on one ride, at a perfectly plausible 15.7 km/h. Speed
cannot catch it. What gives it away is that the recording interval is three seconds and the gap is
fifty minutes — so any leg with timestamps either side, more than two minutes apart and more than
100 m long, is marked as a stretch nobody was observed riding. Nothing snaps to those points and
they are not drawn. Routes without timestamps are exempt: a drawn route's long straight legs are
deliberate, and coordinates alone cannot tell the two apart.

The marked points stay in the array rather than being removed, so every index — and therefore
every segment already cut from that ride — keeps meaning what it did.

Import therefore normalizes both: every ride is **resampled to a maximum 15 m vertex spacing**. On
a drawn route the line between two vertices already is the route, so interpolating along it adds
no error — it just gives the junction-finding tools something to hit. Without it the two sparsest
rides (156 m and 145 m between vertices, 106 km of riding) are invisible to a 25 m junction
search, because the nearest vertex can be 78 m away with the road running directly under the
cursor.

**The rides are not committed.** They start and end at home, so they stay on the machine that made
them and `src-gpx/` is gitignored. Tests run against a synthetic fixture calibrated to the same
spacing and scatter, so a fresh clone passes without them.

Two consequences worth stating up front:

- **The graph will have several disconnected components.** The Everett and Burien tracks almost
  certainly won't touch the Seattle network. This is fine and must not be treated as an error —
  but the admin needs to _see_ components, and the site must never imply you can chain across a
  gap that doesn't exist.
- **Raw GPX is far too heavy to ship.** Full-resolution tracks stay in dev for extraction only.
  Extracted segments are simplified (Douglas–Peucker, **1 m tolerance**) and coordinates rounded to
  6 decimal places (~11 cm) before they reach the browser.

  The tolerance is set by how accurate the source actually is, not by payload. A meter is
  comfortably finer than GPS is good for, and finer than a hand-drawn route is true, while still
  discarding the vertices import interpolated onto straight runs. Measured across the real
  segments, the drawn line stays within **0.99 m** of the recorded one.

  It was first set to 6 m, validated on total length — under 1% error — and that was the wrong
  metric. Length barely moves when corners are cut: at 6 m one real segment fell from 101 source
  points to **4**, a curve rendered as three straight lines, and the worst case strayed **12 m**
  from the road. Anything judged by eye has to be measured by maximum deviation, not by a total.

  Rounding is tied to the same decision. Five decimal places quantise to about a meter, which at
  a 1 m tolerance would add stair-stepping of its own to a line just kept smooth.

---

## 2. Data model

Three entities: **nodes** (junctions), **segments** (edges), **pins** (points of interest that
belong to a segment).

```ts
type Coord = [lon: number, lat: number];
type ElevCoord = [lon: number, lat: number, ele: number]; // ele in meters

type NodeId = string; // "n017"
type SegmentId = string; // "s042"

type Node = {
  id: NodeId;
  name: string | null; // admin-only audit label, never shown to users
  coord: Coord;
};

type Difficulty = "easy" | "medium" | "hard";
type LaneQuality = "poor" | "fair" | "good" | "great";
type Scenic = "low" | "medium" | "high";
type Surface = "asphalt" | "gravel" | "dirt";

type Segment = {
  id: SegmentId;
  name: string | null; // admin-only audit label, never shown to users
  from: NodeId;
  to: NodeId;

  // provenance — which source track this geometry was cropped from
  source: { track: string; startIndex: number; endIndex: number };

  // authored attributes
  difficulty: { forward: Difficulty; backward: Difficulty };
  laneQuality: LaneQuality;
  scenic: Scenic;
  surface: Surface;
  recommendedDirection: "forward" | "backward" | null;
  reviewed: boolean; // false until the attributes above are deliberately set, not defaulted

  // derived at build time from the geometry
  meters: number;
  gainForward: number; // meters climbed traversing from → to
  gainBackward: number;
};

type PinKind = "water" | "restroom" | "photo" | "rest" | "bike-shop";

type Pin = {
  id: string;
  segment: SegmentId;
  kind: PinKind;
  note: string | null;
  at: number; // 0..1 fraction along the segment, from → to. Orders pins along a route.
  coord: Coord; // actual map position; may sit slightly off the line (a fountain in a park)
};
```

### Authoring defaults

A new segment is born with defaults — `medium` difficulty both ways, `fair` lane, `medium` scenic,
`asphalt`, no recommended direction — and `reviewed: false`. Attributes are therefore never
`null`, the site never renders an "unknown" state, and the admin can still tell the difference
between _"asphalt because I checked"_ and _"asphalt because nobody has looked at this yet."_
Extracting a segment stays a fast, low-friction action; judging it is a separate pass.

### Directionality

Segments are **bidirectional with per-direction difficulty**. One geometry, traversable either
way, but `difficulty.forward` and `difficulty.backward` differ where they should — Seattle's
hills make this non-negotiable. Lane quality, scenic value, and surface are shared across
directions.

`recommendedDirection` is nullable and usually null. It exists for the minority of segments where
one direction is clearly correct (a one-way contraflow lane, a descent that's miserable to climb,
a trail that merges badly the other way). When a user's route traverses a segment against its
recommended direction, the sidebar flags it quietly.

### Geometry storage

Geometry lives **separately from metadata**, because the two change on completely different
schedules and mixing them wrecks git diffs:

```
src/db/graph.json              nodes + segment metadata + pins. Small (~30 KB), hand-diffable.
src/db/geometry/s042.json      one point array per segment: ElevCoord[]. Written once, never touched.
src/db/tracks/*.json           full-resolution source tracks. DEV ONLY — never bundled or deployed.
```

A build step compiles those into the runtime format:

```
public/graph.geojson           FeatureCollection, one LineString per segment, attributes as properties
public/pins.geojson            FeatureCollection, one Point per pin
```

### Why GeoJSON at runtime

Handing Mapbox a pre-built FeatureCollection means **filtering and color-coding are data-driven
style expressions**, not React state. Dimming a filtered-out segment or recoloring the whole map
by a different attribute is a paint-property change on the GPU — instant with hundreds of
segments, and no per-segment React components to reconcile.

```js
// color by the currently selected attribute
"line-color": ["match", ["get", "laneQuality"],
  "poor", C.poor, "fair", C.fair, "good", C.good, "great", C.great, C.unknown]

// filters dim, never hide
"line-opacity": ["case", ["boolean", ["feature-state", "passesFilter"], true], 1, 0.15]
```

Adjacency (`nodeId → SegmentId[]`) is derived on load from the feature properties. At this scale
that's under a millisecond and beats maintaining a denormalized index in the file.

---

## 3. Build pipeline

| Step    | Command                             | Input                      | Output                                   |
| ------- | ----------------------------------- | -------------------------- | ---------------------------------------- |
| Import  | `pnpm gpx:import`                   | `src-gpx/*.gpx`            | `src/db/tracks/*.json` (full resolution) |
| Compile | `pnpm graph:build` (runs pre-build) | `graph.json` + `geometry/` | `public/*.geojson`                       |

The compile step is where all derived numbers are computed once: length via haversine, elevation
gain in each direction (with a small threshold to reject GPS noise — only count rises above ~2 m),
bounding boxes, and pin ordering. Nothing derived is ever computed in the browser or stored by
hand.

---

## 4. The site

One user-facing page: a full-screen map with a collapsible sidebar. No other pages, no marketing
copy, no content. The site name in the sidebar is the only prose.

### Building a route

Clicking chains segments together. The route is **append + undo only** — no mid-route editing, no
auto-routing, no pathfinding.

```
click a segment          → it becomes the route; BOTH its ends are live,
                           and every neighbor of either end highlights
click a second segment   → direction resolves; the far end of the chain is now the single live end
click any highlighted    → appends
undo (⌘Z / button)       → pops the last segment; back at one segment, both ends go live again
```

Three visual states while building, and only three: **in the route** (thick, accent colored),
**a viable continuation** (normal weight, clickable), **everything else** (dimmed, not clickable).
A beginner should never have to wonder which click is legal.

Segments may repeat — a route is a walk through the graph, not a simple path. That's what makes
out-and-backs work.

**Before direction resolves** (exactly one segment, both ends live), distance is known but
elevation gain is not — it depends on which way you go. The stats show distance and render gain as
a range (`↑40–180 ft`) rather than picking a direction and quietly lying. It collapses to a single
number on the second click.

Every append and undo calls `pushState`, so the **browser back button is undo**. That's free on
desktop and it's the natural gesture on Android, where the system back button is where a user's
thumb already is.

**Out and back** is a single button: it appends the mirror of the current chain, so the route
returns to where it started. Given append-only editing this composes perfectly and needs no
routing engine.

If the live end has no continuations, the sidebar says so plainly and offers undo. It does not
try to be clever.

### Sidebar

Three things, in this order: the route being built, the stats, the filters.

**Route stats** (only these — deliberately not an estimated ride time, which would be a guess
dressed up as authority):

- Total distance and total elevation gain
- An elevation profile chart across the whole assembled route
- An aggregate attribute summary: stacked bars showing the route's mix — _"73% good or great bike
  lane · 1.2 mi hard · 84% asphalt"_. This is the feature that turns segment metadata into a real
  safety read, and it's the reason a beginner would use this site over Strava.

**Segment detail.** Tapping a single segment swaps the sidebar to its details: length, gain in
each direction, all four attributes, recommended direction if set, its pins, and a mini elevation
profile. Segment _names are never shown_ — they're an admin audit field. Segments are identified
visually, by the highlight on the map.

**Filters** style, never hide. A segment failing an active filter renders dim and thin but stays
present and clickable. Hiding would fragment the graph and strand a user in a disconnected island
with no way to see why.

Difficulty, lane quality, and scenic value are ordered scales, so they are **threshold** controls —
"at most medium difficulty," "at least good bike lane" — which is how the constraint is actually
held in someone's head. Surface is categorical and gets a **multi-select** toggle group. A set of
checkboxes for the ordinals would permit nonsense states like _easy and hard but not medium_.

```
Difficulty     easy ──●── hard   (at most: medium)
Bike lane      poor ──●── great  (at least: good)
Scenic         low  ●──── high   (any)
Surface        [asphalt] [gravel] [dirt]
```

**Color encoding** is user-selectable: difficulty, bike-lane quality, scenic value, or surface.
Surface additionally uses a dash pattern (solid asphalt, dashed gravel, dotted dirt) so it reads
without relying on color.

### Sharing and saving

The segment chain lives in the **URL**: `seaddle.com/?r=s017,s042,s043,s088`. Copy-paste shares a
route, refresh is lossless, and a bookmark is a saved ride. No accounts, no backend.

Because appends push history entries, back-navigating past the empty route leaves the site
normally — history is undo _within_ a route, never a trap.

On top of that, **named saves in localStorage**: "Save this ride," give it a name, and it lists in
the sidebar on return visits. Each saved ride is just its URL plus a name and a timestamp.

### GPX export

**Entirely client-side.** The browser already holds every point; stitching the chain into a GPX
string is a Blob download. No serverless function, no latency, no cold start, works offline. _(The
first draft of this spec assumed a Vercel function for this — it isn't needed and shouldn't be
built.)_

Exported GPX is a single `<trk>` with one `<trkseg>`, elevation included, named from the saved
ride name or generated from distance.

### Mobile

The sidebar becomes a **bottom sheet with three detents**: peek (a one-line stats bar), half, and
full, draggable between. The map stays visible while building a route, which is essential when the
map _is_ the interface.

Touch targets are the real risk: map lines are thin. Segment hit-testing uses a padded
`queryRenderedFeatures` box (~22 px radius on touch, ~8 px on pointer) so a fingertip reliably
picks the intended line.

### No geolocation

The site never asks for location. It opens fit to the graph's bounds and the user pans and zooms
to their own neighborhood.

Worth watching once real segments are on the map: those bounds now span Everett to Burien, and at
that zoom the network is dense. If the first ten seconds feel like a hairball, the cheapest fix is
a row of curated neighborhood chips in the sidebar (name + center + zoom, defined in admin) that
fly the map to a riding-scale view. Not being built now.

---

## 5. Admin

A **dev-only** page. It mounts only when `import.meta.env.DEV`, so it is not in the production
bundle at all — nothing to secure, nothing to leak, no auth to build. Edits happen locally and
ship as commits, which is exactly what static JSON in git wants.

### Edit write-back

A dev-only Vite middleware plugin exposes write endpoints:

```
POST /__admin/graph          → fs.writeFile src/db/graph.json  (pretty, stable key order)
PUT  /__admin/geometry/:id   → fs.writeFile src/db/geometry/:id.json
GET  /__admin/tracks/:slug   → streams a full-resolution track (never bundled)
```

Edits autosave to disk; `git diff` is the review step. Stable key ordering and consistent number
formatting matter here — a diff that reorders 200 segments on every save is useless.

### The extraction workflow

Nodes are defined first, segments second. This inverts the obvious "cut tracks into pieces"
approach, and it's better: junctions become real objects placed where intersections actually are,
segment geometry gets _chosen_ rather than inherited from whichever GPX happened to be cut, and
junction dedup falls out by construction instead of being a cleanup pass.

**Step 1 — Heatmap.** Render all 21 source tracks as a single line layer at low opacity. Overlaps
accumulate, so heavily-ridden roads glow and the shape of the network becomes obvious. Line width
scales with zoom.

**Step 2 — Place nodes.** Click a junction. The click snaps to the nearest track point within
~20 m (so nodes sit _on_ the tracks), then snaps to an existing node within ~15 m if one is there —
so clicking the same intersection twice reuses one node rather than creating a twin. Nodes can be
named, dragged, and deleted (with a warning when segments reference them).

**Step 3 — Extract a segment.** Select node A, then node B. The candidate finder:

- finds every point index on every track within radius R (default 25 m) of A, and of B
- forms all (iA, iB) index pairs and extracts each sub-path — **including reversed traversals**,
  normalizing stored geometry to run from → to
- handles loops correctly: a track passing A twice yields several valid pairs, so take the pair
  with the shortest sub-path and surface the alternates if the result looks wrong
- **scores** each candidate on detour ratio (path length ÷ great-circle A→B), endpoint distance to
  the nodes, point-spacing regularity, and point count
- rejects candidates above a detour threshold (default 3.0, adjustable — some legitimate segments
  curve hard around a lake). A track that touches both A and B but wanders three miles in between
  must not be offered as a segment.

**Candidates are ordered most recent ride first.** A road gets resurfaced and a trail gets
rerouted, so the newest pass is the one that reflects what is actually there now. Scoring still
decides what qualifies at all — a candidate that wanders is rejected outright rather than merely
ranked low — and every number behind it stays on the card, so a bad ordering is visible rather
than hidden. Drawn routes carry no date and sort last, ordered among themselves by how cleanly
they run.

Each candidate shows its ride date, length, gain, point count, and detour ratio; hovering one
previews it on the map. Strava names every ride "Afternoon Ride", so where there is a date it
leads and the name follows underneath — a drawn route was named by hand, so its name leads
instead.

**Step 4 — Crop and store.** The chosen sub-path is cropped, its **endpoints snapped to the exact
node coordinates** (otherwise segments meeting at one junction end a few meters apart and render
with visible hairline gaps), simplified, rounded, and written to `geometry/<id>.json`.

**Step 5 — Metadata.** A keyboard-friendly form: the four attributes, per-direction difficulty,
recommended direction, optional name. Saving it sets `reviewed: true`. Autosaves.

Judging ~200 segments one form at a time is the real cost of this project, so the admin also
supports **multi-select bulk editing** — lasso or shift-click several segments and set surface or
lane quality across all of them at once. Whole trails share attributes; the Burke-Gilman is one
answer, not forty.

**Step 6 — Pins.** Click along a segment to drop a pin; `at` is computed by projecting the click
onto the polyline, and the pin can then be dragged off the line to its true position.

### Supporting tools

- **Identifying what is on the map** — hovering a mapped segment names it at the cursor (id, name,
  length, climb), and in Segments mode clicking one selects it: the matching row scrolls into view,
  highlights, and puts the cursor in its name, so a line spotted on the map can be named without
  going looking for it in a list of hundreds. A toggle draws every segment's label along its line —
  ids when zoomed out, names once there is room for them.
- **Manual connect** — force-join two node endpoints farther apart than the snap tolerance (a
  bridge deck, a trail gap), merge two nodes into one, or reassign a segment endpoint to a
  different node. Auto-snapping handles ~95%; this covers the rest.
- **Coverage view** — dims heatmap track mileage already covered by a segment, and shows a
  counter ("142 of ~380 track-miles covered"). Answers "what's left" and "am I done" visually.
- **Validation panel** — orphan nodes, segments referencing missing nodes, duplicate segments
  between the same node pair, unsnapped endpoints, an **unreviewed count** (`reviewed: false`), and
  a list of **connected components** with their sizes, so the Everett/Burien islands are a known
  fact rather than a surprise.

---

## 6. Style

- **Font:** Didact Gothic (Google Fonts), self-hosted via Fontsource to avoid a render-blocking
  third-party request.
- **Feel:** outdoorsy, friendly, inviting. Not childish, definitely not serious.
- **Palette:** forest green primary with earthy neutrals, in the spirit of wta.org — deep green,
  moss, bark brown, sand, warm off-white. Light theme only.
- **Controls:** buttons and inputs in the PostHog style — solid fill, defined border, a hard offset
  shadow that gives a 3D appearance, and a press state that translates the element into its own
  shadow. Chunky, tactile, obviously clickable.
- **Basemap:** a **custom Mapbox Studio style**, muted and desaturated, built so green route lines
  read clearly against it. Stock styles fight the palette; Outdoors especially competes with the
  segment color encoding. Development proceeds against **Mapbox Standard as a placeholder**; the
  Studio style is designed during the polish milestone and swapped in as a one-line style-URL
  change.
- **Attribution stays on.** Mapbox requires it on every map — tuxc sets `attributionControl={false}`,
  which is a licensing violation and must not be ported. It renders as the compact control,
  styled to sit quietly in the corner.
- **Segment color ramps** are per attribute and chosen for contrast against the muted basemap:
  difficulty runs green → amber → rust with distinct lightness steps (so it survives deuteranopia,
  not just hue); lane quality is a single-hue sequential ramp across four steps; scenic is a
  three-step sequential ramp; surface is categorical, reinforced by dash pattern.

### Accessibility

Keyboard-operable route building, visible focus rings, `prefers-reduced-motion` respected on map
flights and sheet transitions, 44 px minimum touch targets, and color never as the sole encoding
(surface uses dashes; the sidebar always states attributes in words).

### Performance budget

App JS under 100 KB gzipped excluding mapbox-gl, `graph.geojson` under 300 KB gzipped, first
meaningful map paint under 2.5 s on 4G.

---

## 7. Tech stack and conventions

Vite · React · TypeScript · Tailwind · Mapbox GL (via react-map-gl) · Vercel · pnpm.

**No analytics, no error tracking, no third-party scripts.** Nothing to configure, nothing to
disclose, no consent banner, nothing slowing the first paint.

A Mapbox token lives in `VITE_MAPBOX_TOKEN`. It ships to the browser by definition, so **URL
restriction on the token is the only real protection** — it must be scoped to the production domain
plus localhost before deploy.

Structure mirrors the tuxc codebase (`components/` · `widgets/` · `lib/` · `db/`, kebab-case
filenames, `@/` alias, eslint + prettier + prettier-plugin-tailwindcss, Radix primitives, Phosphor
icons) with **modernized dependencies**: React 19, Tailwind v4, current Vite, flat eslint config.

Ported from `/Users/chris/Documents/Code/Projects/Done/tuxc`:

- `lib/utilities/map-utils.ts` — haversine, bounds aggregation, fitting, GeoJSON line features
- `lib/mapping/query-engine.ts` — the grid-cell spatial index, which is exactly the right structure
  for the admin's "all track points within R of this node" query
- `lib/models/point.ts`, the `import.meta.glob` db pattern, and the button/input widget styles

### Testing

Vitest over the pure logic — geometry math, graph traversal and adjacency, candidate scoring and
cropping, GPX generation, route stats aggregation. These are the places where a silent bug
corrupts data or lies to a beginner about a hill. No component or E2E tests. GitHub Actions runs
typecheck, lint, and tests.

---

## 8. Milestones

1. ~~**Foundation**~~ — project scaffold, data model types, `gpx:import`, `graph:build`, ported map
   utilities, tests for the geometry math.
2. ~~**Admin core**~~ — heatmap, node placement with snapping, candidate finder, extraction, crop
   and write-back.
3. ~~**Site core**~~ — map, segment chaining, sidebar, distance/gain/profile stats.
4. **Admin completion** — ~~metadata editor~~, ~~slicing the rides into a full graph~~ (153
   segments, 261 miles). Still open: **pin editor**, **manual connect**, **coverage view**,
   **validation panel** — the last only exists as warnings printed by `graph:build`.
5. ~~**Site completion**~~ — filters, color encoding, attribute summary, out-and-back, URL
   sharing, localStorage saves, GPX export.
6. **Polish** — ~~mobile bottom sheet~~. Still open: **custom Studio basemap** (both maps are
   still on the stock light style), **accessibility pass**, **performance** — app JS is 106 kB
   gzipped against a 100 kB budget.

Beyond these, [`auto-routing.md`](auto-routing.md) specifies connectors — routing a rider from
their front door to the graph — and is unbuilt. It gates itself on milestone 5, which is now done.

The review pass gates the rest of the site's value: every segment still carries default
attributes, so filters and color encoding work correctly against data that says nothing yet.

Admin leads because the site has nothing to render without a real graph, and every interaction
decision made against fake data is a guess. But it cuts over to the site at ~10 segments (step 3)
rather than after the whole graph is sliced — seeing the real product early is worth more than a
complete dataset.

---

## 9. Open questions

- **Close the loop.** A "get me back to the start" button needs a Dijkstra pass over the graph.
  It's maybe 40 lines and genuinely useful, but it's the one piece of pathfinding in an otherwise
  click-only design. Deferred, not rejected.
- **Duplicate geometry.** Where two source tracks cover the same road, the extraction workflow
  picks the cleaner one — but nothing prevents creating two segments for the same stretch between
  different node pairs. The validation panel should probably detect near-parallel duplicate
  geometry, not just identical node pairs.
- **Segment granularity.** How long should a typical segment be? Too fine and route building is
  tedious; too coarse and the metadata stops being meaningful. Worth deciding empirically after
  the first ten.
- ~~**Cold start.**~~ Settled at milestone 3: with 145 segments across 260 miles, opening fit to
  the whole network reads as a map of where you can ride rather than as a hairball. No neighborhood
  picker needed.
- **Pin sourcing.** All pins are hand-placed for now. Seattle Parks publishes fountain and restroom
  data, and OSM has both — an import could seed them, at the cost of accuracy.
