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
how hard it is, how protected it is, how pretty it is, what it's paved with — so a route's
character is the sum of its parts rather than an opaque line on a map.

---

## 1. Source data

`src-gpx/` holds 43 GPX files (~109,000 track points, ~2,000 km, 23 MB raw). Coverage spans
Seattle proper, the Eastside (Mercer Island, Sammamish, May Valley), and outlying tracks in
Everett, Edmonds, Burien, and Bainbridge.

**The sources are mixed, and nothing downstream may assume otherwise.** Twelve rides are drawn in
Mapometer and snapped to roads; thirty-one are recorded by Strava off a GPS. Measured across both:

| | vertex spacing | spacing variability | 6 m simplify loss | raw ↑ vs filtered ↑ |
| --- | --- | --- | --- | --- |
| Strava (31) | 8–22 m | cv 0.69–12.17 | 0.24–4.44% | 437 m → 296 m |
| Mapometer (12) | 14–156 m | cv 1.06–3.07 | 0.06–0.83% | 723 m → 546 m |

Spacing is the mean between neighboring vertices on a ride, and the climb is the median ride in
the group. The top of each Strava range is one outlier, and neither is about sampling: both are
rides whose recorder stopped, which leaves a single enormous straight leg that inflates the
spread and survives simplification when nothing else in the ride does — the subject of two
paragraphs down.

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

type Steepness = "flat" | "rolling" | "steep";
type Protection = "unprotected" | "bikeLane" | "bikePath";
type Surroundings = "plain" | "pleasant" | "beautiful";

type Segment = {
  id: SegmentId;
  name: string | null; // shown to riders on hover where set
  from: NodeId;
  to: NodeId;

  // provenance — which source track this geometry was cropped from
  source: { track: string; startIndex: number; endIndex: number };

  // authored attributes
  steepness: Steepness; // undirected: the same hill whichever way you meet it
  protection: Protection;
  surroundings: Surroundings;
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

A new segment is born with defaults — `flat` steepness, `unprotected`, `plain` surroundings,
`asphalt`, no recommended direction — and `reviewed: false`. Attributes are therefore never
`null`, the site never renders an "unknown" state, and the admin can still tell the difference
between _"asphalt because I checked"_ and _"asphalt because nobody has looked at this yet."_
Extracting a segment stays a fast, low-friction action; judging it is a separate pass.

### Directionality

Segments are **bidirectional**, and no authored attribute is per-direction. One geometry,
traversable either way, described the same way each way.

Steepness was the one attribute that argued otherwise — Seattle's hills are brutal one way and
free the other — and it lost the argument. A two-sided field has to be swapped in step every time
a segment is turned around, kept honest against geometry that already knows the answer, and read
by asking which side to believe; every one of those was a place to get it wrong. Steepness is now
the climb in whichever direction climbs more, seeded from the elevation data by
`pnpm attributes:seed`. Which way a hill is nicer to ride is a routing question, and the elevation
profile answers it better than a label could.

There was a `recommendedDirection` here, for the minority of segments where one way is clearly
the right way — a contraflow lane, a descent miserable to climb. It is gone. In 158 segments it
was never once set, because the elevation profile already says which way the hill runs and the
attributes are undirected on purpose; the field cost a control in the editor, a column in the
data, and a trip through the compile step, and nothing on the site ever read it.

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

Handing Mapbox a pre-built FeatureCollection means **color-coding and reachability are data-driven
style expressions**, not React state. Recoloring the whole map by a different attribute, or fading
every segment the route cannot reach, is a paint-property change on the GPU — instant with hundreds
of segments, and no per-segment React components to reconcile.

```js
// color by the currently selected attribute
"line-color": ["match", ["get", "protection"],
  "poor", C.poor, "fair", C.fair, "good", C.good, "great", C.great, C.unknown]

// the segments a route can still take, bright and wider than the rest
"filter": ["in", ["get", "id"], ["literal", continuations]]
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

Three visual states while building, and only three: **in the route** (cased in dark), **a viable
continuation** (full colour, clickable), **everything else** (dimmed, not clickable). A beginner
should never have to wonder which click is legal.

The route is **cased, not recoloured**. Painting it a flat accent said "chosen" by throwing away the
steepness or the bike lane that made it worth choosing — which is the one thing this map exists to
show — so instead a dark casing is drawn underneath and the segment keeps its own colour. The route
and the choices leading off it can then be compared on the encoding while the route stays obvious.

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

Three things, in this order: the route being built, the stats, and what can be done with it.

**Before a route starts, the stats stand down.** Distance and gain hold the sidebar's pinned slot —
the one strip visible at every sheet detent — and before the first pick they are two zeros, which is
not a reading but the absence of one. So the empty state gives that slot to the invitation instead:
one amber-bordered line, _"Build your route — tap any segment on the map to add it,"_ naming the
gesture the machine at hand actually has (a tap without a hovering pointer, a click with one). The
numbers take the slot back on the first pick, which is the moment they begin to mean something.

It is set to wrap and sized to fill both lines. The sentence wants more width than the sidebar's
text column has at any size worth reading, so one line is not on offer; balancing the two lines
without also growing the type just empties the right half of the band. Balanced and large is what
makes the break look chosen.

Under it, in the scrolling body, the model in three lines — segments chain, the bright ones are the
legal next moves, and a finished route can be kept or exported. None of that is readable off a map
of lines, and all of it is what a beginner is missing. Three is the budget: the body is below the
fold on a phone at rest, so it has to reward a drag without being homework standing between anyone
and their first pick.

**Route stats** (only these — deliberately not an estimated ride time, which would be a guess
dressed up as authority):

- Total distance and total elevation gain
- An elevation profile chart across the whole assembled route
- An aggregate attribute summary: stacked bars showing the route's mix — _"73% good or great bike
  lane · 1.2 mi hard · 84% asphalt"_. This is the feature that turns segment metadata into a real
  safety read, and it's the reason a beginner would use this site over Strava.

**Segment detail** is a **mode**, not a second meaning for the same click. A click on a segment
cannot both add it and describe it, so the map has two: **build** (a shovel) and **explore**
(binoculars), toggled from the first of three buttons on the map — mode, colors, settings. The
choice is kept in `localStorage` like the choice of basemap — it is a setting rather than a step in
anything, and being put back into a mode you deliberately left is the kind of small insult a reload
should not be able to deliver. Which segment was being read is *not* kept: that is where the reader
had got to, not a preference, and restoring it would open a panel of details about a segment nobody
just tapped.

Switching either way raises a short notice over the map — _"Explore mode. Tap any segment to learn
about it."_ — in the same slot that explains why a tapped segment did
nothing. A mode is the one change here that alters what a click means while showing almost nothing
for it: the icon swaps and the panel swaps, and neither says the rules just changed. It lingers four
seconds rather than the six a refusal gets, because it confirms something the rider did on purpose
instead of teaching a rule they did not know.

Every notice can be **put away early** — an X, a swipe either way, or a tap anywhere on it. The card
therefore has to receive pointer events, where everything around it stays transparent to the map; a
tap counts as a dismissal precisely because of that, since while the card is up it is in the way of
the segment beneath it and a tap that did nothing would read as the map having stopped working.

Exploring is where a rider arrives who has never chosen otherwise — the first question a map of a
strange city gets is what its lines are, not which of them to chain, and building answers a question
that has not been asked yet. A link carrying a route is the exception: that rider was sent something
to look at, and the panel holding its distance, climb, profile, and GPX button is the route panel.
It overrides the default only, never a stored choice. Exploring frees the whole network to be
clicked — not just the segments that continue the route — and swaps the sidebar for the one segment
being read: its name, its length, its climb, its three attributes, and its elevation profile.
Clicking the ground between segments puts it down again. The route is left alone throughout and
comes back untouched under the shovel, so exploring is free to step into mid-route, which is when
the question it answers actually comes up.

That the whole network goes live is the point. In build mode a rider can only interrogate the
segments that happen to join their route, which is exactly backwards: the segments worth reading
about are ones you have not committed to. And hovering — the only way to read a segment while
building — does not exist on a phone and is gone the moment the pointer moves, so it can neither be
read at leisure nor compared between two segments.

The panel **comes up to meet a tapped segment**, which is the opposite of what it does while
building and for the same reason. A pick while building is a change on the map, so rising would
cover the answer; here the panel _is_ the answer, and delivering it below the fold on a phone is
delivering nothing. What the map has to say — the casing and the two end marks — stays above the
sheet. Putting the segment down drops the panel back.

The three attributes are the largest thing in it, name aside, ruled like a spec sheet: quiet labels,
large answers, the same three rows in the same three places every time, so a rider tapping segment
after segment reads only the words that changed. They ran together as _"flat · unprotected · plain"_
at first, which reads as three adjectives about one thing rather than three answers to three
different questions — and nobody new can tell which scale "plain" came off.

Each answer is a **filled badge in the color of its verdict**: green for good, amber for caution,
red for poor, muted sand for the merely unremarkable. That is a *second* reading of these three
scales and deliberately not the one `RAMPS` gives the map. A ramp answers "which step of this scale
is this segment on", so every value is distinct and the order is carried by lightness; a badge
answers "is this in my favour", which two values can answer the same way. Hence protection reads
red-green-green here while the map draws it tan, magenta, violet — a bike lane and a bike path are
both a yes to a beginner asking whether they will be in traffic, and ranking them is the map's job,
where there is a legend. The cost is that "bike lane" is a green pill beside a magenta line; the
benefit is that the right-hand column can be read without being read at all.

They are built the way everything filled on this site is built — a deeper edge around the color's
own fill, with forest or paper type on top, whichever clears the contrast floor. That is the
button's construction minus the parts that promise a press: no offset shadow to drop into, no
fingertip height, and the chips' radius rather than the buttons'. `neutral` is the outline button
and the unchosen chip, because a value whose whole meaning is that it is unremarkable should not
arrive with the weight of the three that mean something. Filling moss needed a `moss-deep` edge,
which blaze and clay already had.

Names _are_ shown here, reversing an earlier decision. They were called an admin audit field on the
grounds that segments are identified visually, which holds while building — the highlight says which
segment — but not while reading one, where matching the line under your finger to the street you
know is most of what the reader came for.

The selected segment is cased in forest-deep and drawn under every other line — the same mark the
route carries while building, for the same reason, and never both at once: over here the route is
not the subject, and casing it too would leave the one segment being read nothing to stand out from.
The pale highlighter used for keyboard attention could not do that job over a near-white basemap.

Its two ends carry the admin's **green dot and checkered flag**. The panel's chart is one segment
laid out left to right and a line on a map has no visible direction, so without them nothing says
which end the climb starts from — and the direction shown is the recorded one, which is not
necessarily the one anybody would ride.

**Color encoding** is user-selectable: steepness, protection, surroundings, or grade. Grade is the
one that is not a segment attribute: it is read from the recorded elevation point by point and
colors *within* a segment, which is why it is the only one the key draws as a bar rather than as a
row of named steps.

It is chosen from four cards rather than four chips, each carrying its mark, the question it
answers, and its own ramp with the values named under it. A row of chips gave the names and nothing
else, so the choice had to be made by guessing what "surroundings" would look like and then closing
the dialog to find out. The card is the key to the map before the map has changed.

**Filters are gone.** They were threshold controls over the same three scales — "nothing steeper
than rolling," "at least a bike lane" — dimming rather than hiding, since hiding would fragment the
graph and strand a rider in a disconnected island with no way to see why. They worked, and almost
nobody opened them: the segments a beginner would have filtered out are already colored on the map,
already badged in the explore panel, and already counted in the breakdown of their own route, so the
dialog was a second, slower way to learn what the map says at a glance. A control nobody opens is
not free — it is a button in a row that every other button then has to be told apart from.

**Settings** hold what is answered once and lived with: the ground the map is drawn on, the units
every number is read in, and whether a pick moves the camera. The line against colors is how often
the question comes back — what the map is *colored by* changes as a rider's question changes, while
these three are set by taste and forgotten. The basemap moved across that line; it had been sitting
with the encoding because both were colors, which is a fact about the code rather than about anyone
using it.

- **Map style** is picked from four small maps, two by two, rather than four named chips. Every
  ground here is land above 90% lightness and the quiet ones part company mainly in what the water
  does, so a swatch had to invent a color that was nowhere in the palette to tell them apart at all.
  Each option draws its own map instead — the same shoreline, street web, and park, painted from its
  own table — and carries a route across it, cased and green, because surviving a route drawn on top
  is the one thing every ground on this site has to do. The four are being compared rather than read
  down, which is what puts them in a block and the name above each drawing rather than beside it —
  and the drawings are letterboxed, because four previews are most of what stands between this
  dialog and a scrollbar.
- **Units** are one choice covering distance and height together — miles & feet, or km & meters —
  because nobody holds "miles, with the climbing in meters". The default is imperial, since this is
  a map of Seattle, unless the browser names a region that rides in kilometers.
- **Auto-zoom** is on by default: a rider who has just added a segment is looking for what comes
  after it. Turning it off stops the camera following a route being built, but still frames a
  finished one arriving from a link or the saved list — that one is being *shown* to them.
- The dialog ends in a **colophon**: the mark, the byline, and the year. Worth finding, not worth a
  permanent line of the screen, and whoever went looking for the settings is already the person who
  wondered where this came from.

Surface is gone entirely — from the color encodings, from the admin editor, and from the stored
record. Every segment in the network is asphalt, so the attribute only ever had one honest answer,
and an editor field nobody ever changes is a field that eventually gets set wrong.


### Sharing and saving

The segment chain lives in the **URL**: `seaddle.com/?r=17-42-43-88`. Copy-paste shares a route,
refresh is lossless, and a bookmark is a saved route. No accounts, no backend.

Spelled for the address bar rather than for the parser. A query string is written in form encoding,
which leaves alone exactly the letters, digits and `*-._` — so the comma this used to join on
arrived as `%2C` and the out-and-back token `~` as `%7E`, and the one thing a rider is meant to copy
and send read like a mistake. Hyphens survive, and dropping the `s` and the zero padding makes the
link *shorter* than the format that kept them. Ids are reconstructed by padding back to three
digits, which is what `nextId` writes and is a no-op above 999 — so there is no ceiling to walk into
and no build-time guard to remember. The decoder reads the old spelling too: links outlive their
formats, and routes written `s017,s042` are in bookmarks and in the saved list in people's browsers.

Because appends push history entries, back-navigating past the empty route leaves the site
normally — history is undo _within_ a route, never a trap.

A second parameter shares a **segment** rather than a route: `?s=42` is the one being read in
explore mode, written on every tap and spelled the same way the segments in a route are. It is only
ever *replaced* into the current history entry, never pushed — back and forward walk the route
timeline, and spending them on un-selecting segments would bury the turns worth taking back. Both
parameters coexist, so stepping into explore mid-build does not cost a rider the route out of their
own address bar; `?s=` is dropped while building, because it would otherwise open a stranger on a
segment nobody is looking at.

**The link outranks what the browser remembers.** Mode is stored in `localStorage`, but a link that
names something is somebody handing over a specific thing to look at, so it is read first: `?s=`
opens in explore on that segment, `?r=` alone opens in build on the route panel, and only a link
carrying neither falls back to the stored choice. Arriving on someone else's link never writes that
mode back to storage. A link naming a segment also frames the map on it, ahead of any route it
carries — the segment is what the panel is about.

On top of that, **named saves in localStorage**: "Name this route," give it a name, and it lists in
the sidebar on return visits. Each saved route is just its URL plus a name and a timestamp. The
distance and climbing each row shows are read back out of the graph as the list is drawn rather
than stored beside the name — segments get recut, and a distance written down last
month would go on being shown long after it stopped being true.

A row is renamed in place, and **names are unique**, because the list is read by them: saving or
renaming onto a name already in the list asks first, then takes the name and forgets the route that
held it.

### GPX export

**Entirely client-side.** The browser already holds every point; stitching the chain into a GPX
string is a Blob download. No serverless function, no latency, no cold start, works offline. _(The
first draft of this spec assumed a Vercel function for this — it isn't needed and shouldn't be
built.)_

Exported GPX is a single `<trk>` with one `<trkseg>`, elevation included, named from the saved
route name or generated from distance.

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

**Step 1 — Heatmap.** Render all 43 source tracks as a single line layer at low opacity. Overlaps
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

**Step 5 — Metadata.** A keyboard-friendly form: the four attributes, steepness,
recommended direction, optional name. Saving it sets `reviewed: true`. Autosaves.

Judging ~200 segments one form at a time is the real cost of this project, so the admin also
supports **multi-select bulk editing** — lasso or shift-click several segments and set surroundings
or lane quality across all of them at once. Whole trails share attributes; the Burke-Gilman is one
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

There were two more here — a **coverage view** dimming heatmap mileage already cut into segments,
and a **validation panel** listing orphan nodes, missing references, duplicate node pairs and
connected components. Neither is being built. The graph is sliced, so "what's left" is a question
that has been answered once and will not be asked again; and `graph:build` already prints every
check the panel would have shown, on the one occasion that matters — the step that writes what the
site loads. A screen in the admin would be a second place to look for the same facts.

---

## 6. Style

- **Font:** Didact Gothic (Google Fonts), self-hosted via Fontsource to avoid a render-blocking
  third-party request.
- **Feel:** outdoorsy, friendly, inviting. Not childish, definitely not serious.
- **Palette:** forest green primary with earthy neutrals, in the spirit of wta.org — deep green,
  moss, bark brown, sand, warm off-white. Light theme only.
- **Controls:** buttons and inputs in the 3D style — solid fill, defined border, a hard offset
  shadow that gives a 3D appearance, and a press state that translates the element into its own
  shadow. Chunky, tactile, obviously clickable.
- **Basemap:** a **custom Mapbox Studio style**, muted and desaturated, built so green route lines
  read clearly against it. Stock styles fight the palette; Outdoors especially competes with the
  segment color encoding. Development proceeds against **Mapbox Standard as a placeholder**; the
  Studio style is designed during the polish milestone and swapped in as a one-line style-URL
  change.
- **Attribution stays on.** Mapbox requires it on every map — the earlier codebase sets
  `attributionControl={false}`, which is a licensing violation and must not be ported. It renders
  as the compact control, styled to sit quietly in the corner.
- **Segment color ramps** are per attribute and chosen for contrast against the muted basemap:
  steepness runs green → amber → rust with distinct lightness steps (so it survives deuteranopia,
  not just hue); protection is a single-hue sequential ramp across three steps; surroundings is a
  three-step sequential ramp.

### Accessibility

Keyboard-operable route building, visible focus rings, `prefers-reduced-motion` respected on map
flights and sheet transitions, 44 px minimum touch targets, and color never as the sole encoding
(the sidebar always states attributes in words).

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

Structure mirrors an earlier project of mine (`components/` · `widgets/` · `lib/` · `db/`,
kebab-case filenames, `@/` alias, eslint + prettier + prettier-plugin-tailwindcss, Radix
primitives, Phosphor icons) with **modernized dependencies**: React 19, Tailwind v4, current Vite,
flat eslint config.

Ported from that project:

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
4. **Admin completion** — ~~metadata editor~~, ~~slicing the rides into a full graph~~ (158
   segments), ~~pin editor~~. Still open: **manual connect** — merging two nodes is built, forcing
   a join across the snap tolerance and reassigning a segment endpoint are not. The coverage view
   and validation panel that stood here are dropped, for the reasons in §5.
5. ~~**Site completion**~~ — color encoding, attribute summary, out-and-back, URL sharing,
   localStorage saves, GPX export. Filters were built here and later removed; §4 says why.
6. **Polish** — ~~mobile bottom sheet~~. Still open: **custom Studio basemap** (both maps are
   still on the stock light style), **accessibility pass**, **performance** — app JS is 136 kB
   gzipped against a 100 kB budget.

Beyond these, [`auto-routing.md`](auto-routing.md) specifies connectors — routing a rider from
their front door to the graph — and is unbuilt. It gates itself on milestone 5, which is now done.

The review pass gates the rest of the site's value: every segment still carries default
attributes, so the color encoding works correctly against data that says nothing yet.

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
  different node pairs. Detecting near-parallel duplicate geometry would want to live in
  `graph:build` alongside the checks that are already there.
- **Segment granularity.** How long should a typical segment be? Too fine and route building is
  tedious; too coarse and the metadata stops being meaningful. Worth deciding empirically after
  the first ten.
- ~~**Cold start.**~~ Settled at milestone 3: with 145 segments across 260 miles, opening fit to
  the whole network reads as a map of where you can ride rather than as a hairball. No neighborhood
  picker needed.
- **Pin sourcing.** All pins are hand-placed for now. Seattle Parks publishes fountain and restroom
  data, and OSM has both — an import could seed them, at the cost of accuracy.
