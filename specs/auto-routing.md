# Auto-routing: connectors

A companion to `index.md`. It covers one feature: getting a user from their front door to the
seaddle graph.

## 1. The problem

`index.md` §4 says routes are built by clicking segments, and that the site never asks for the
user's location. Both hold. But the graph is a network of _good roads someone has ridden_, not a
network that reaches every house in Seattle. A user in Wallingford looking at a Mercer Island loop
has no way to express the first four miles of their actual ride.

A **connector** is a routed leg between an arbitrary point and the graph. It is not a segment, it
never enters the graph, and it carries no authored metadata.

The reference implementation people ask for is Mapometer's snap-to-roads drawing: click along a
road and the line follows it. Worth separating the two things hiding in that request:

- **Freehand snap-to-roads drawing** — the user traces a path, click by click, and each click
  snaps. Manual, and it's really just repeated two-point routing calls.
- **Point-to-graph routing** — the user names a start, picks a segment end, and gets a leg.

Only the second is needed. It's one call instead of a dozen, it's fewer decisions for a beginner,
and it's the thing that actually answers "can I ride to this from my house?" Freehand drawing is a
route _editor_, and seaddle is deliberately not one.

---

## 2. Provider choice

### Mapbox is capable and disallowed

Mapbox supports this well. The [Directions API][dir] has a `mapbox/cycling` profile that avoids
highways and prefers streets with bike lanes, takes up to 25 waypoints, and exposes `radiuses` /
`bearings` / `approaches` for snap control. The [Map Matching API][mm] is the literal snap-to-roads
primitive, though it's built for cleaning up an existing GPS trace and isn't the right tool here.
The free tier is 100k requests/month, so cost never enters into it.

The blocker is licensing. Mapbox Product Terms (October 1, 2025) §2.10.1:

> Customer shall not export, download, cache or store results from any request to a Navigation API.

Directions and Map Matching are both Navigation APIs. That forbids three features `index.md`
already commits to: **GPX export**, **localStorage named saves**, and **URL sharing** — every one
of which persists route geometry by definition.

There is a partial workaround. Store the user's _waypoints_ — their own input, not Mapbox output —
and re-request the geometry on load. That rescues URL sharing and localStorage honestly. It does
not rescue GPX export, which necessarily writes routed geometry into a file the user keeps. Two
of three, with the headline one broken, is not a good trade for an API we'd otherwise have to
work around anyway.

Two secondary strikes, either of which would cost a workaround on its own:

- Directions returns **no elevation**. Connector gain would need a second data source.
- If an address box is ever wanted, Temporary Geocode terms (§2.7.2) carry the **same storage
  prohibition**, and `permanent=true` is billed differently.

Mapbox stays the basemap and the renderer. It is not the router.

### OpenRouteService — the choice

[OpenRouteService][ors]: hosted, free API key, `cycling-road` and `cycling-safe` profiles, GeoJSON
output, and `elevation: true` returns 3D coordinates that drop straight into the existing
`ElevCoord` tuple with no conversion. OSM data under ODbL, so **storing and exporting are fine**
with attribution — which is the whole reason it wins.

Free tier is roughly 2,500 requests/day. _Confirm at signup; that figure comes from a third-party
aggregator, not ORS's own page._ Attribution goes next to the existing Mapbox attribution control.

### BRouter — the upgrade path

[BRouter][br] (MIT) has the best bicycle profiles in the open-source world — its `.brf` scripts
model gradient penalties, surface cost, and safety preference far more deliberately than a generic
cycling profile. Elevation-aware by design. The catch is operational: the public instance publishes
no usage policy for third-party apps, so relying on it for a public site is both fragile and rude.
Using BRouter means self-hosting.

Start with ORS. Move to a self-hosted BRouter only if connector quality turns out to be visibly
worse than the hand-judged segments next to it.

[dir]: https://docs.mapbox.com/api/navigation/directions/
[mm]: https://docs.mapbox.com/help/glossary/map-matching-api/
[ors]: https://openrouteservice.org/services/
[br]: https://github.com/abrensch/brouter

---

## 3. The unrated-geometry problem

This is the part that matters, and it's a design problem rather than a technical one.

`index.md` opens by rejecting "an opaque line on a map." A routed connector is exactly that. The
router knows nothing about lane quality, steepness, or surface, and the connector is precisely
where a beginner is most likely to be pushed onto an arterial — it's the leg nobody has ridden and
judged.

So a connector must never be silently folded into the route's numbers.

- **On the map:** visually distinct — dashed, neutral colored, never the accent green that means
  "in the route." It reads as a different kind of thing because it is one.
- **In the stats:** broken out on its own line — `2.1 mi connector · unrated` — and **excluded
  from the attribute summary**, with the bars labeled as covering rated segments only.
- **Distance and gain** may be summed into the totals, since those come from geometry rather than
  from judgment. Nothing else may be.

This is the same instinct as the elevation range in §4: when direction hasn't resolved, the stats
show `↑40–180 ft` rather than picking one and quietly lying. Same rule, different unknown.

---

## 4. How it composes

A connector is a **prefix or suffix on the chain, not a graph edge**. It does not become a
`Segment`, it does not get an id in `graph.json`, and it does not create nodes.

This falls out cleanly against the append-only design:

- adjacency and the candidate-highlighting logic are untouched — they still only ever see segments
- undo pops a connector the same way it pops a segment
- a route is still a walk through the graph, with at most one connector at each end

No pathfinding is introduced _within_ the graph, which keeps the click-only promise intact. The
routing happens strictly outside it.

### Setting the start point

**Click the map.** No geocoder, no address box, no autocomplete. This sidesteps an entire API and
its terms, and matches the no-accounts/no-backend minimalism everywhere else in the spec.

§4's "the site never asks for location" is about the permission prompt. A user placing their own
start point by clicking is not that, and doesn't reopen the decision.

### URL format

The chain already lives in the URL. Connectors extend it with **waypoints, never geometry**:

```
seaddle.com/?r=s017,s042,s043&from=-122.31,47.65
```

Short, diffable, re-resolvable on load, and license-clean under any provider we might switch to
later. Coordinates round to 5 decimals like everything else. `&to=` mirrors it for a connector off
the far end.

Geometry is re-requested on load. A failed request degrades to the segment-only route with a quiet
note, never a broken page.

### GPX export

The connector is stitched into the single `<trk>` in chain order, same as any segment. Elevation
comes from the router's 3D coordinates. This is the feature that decided the provider, so it should
work without qualification.

---

## 5. Open questions

- **Which end?** A connector on the start is obvious. One on the finish is symmetric and probably
  wanted, but two connectors plus an out-and-back needs its interaction thought through.
- **Which graph point?** Routing to the nearest node is the cheap answer; letting the user pick the
  entry point is the honest one, since "nearest" is often across a lake.
- **Caching.** ORS's daily allowance is generous but finite, and a user dragging a start point
  around could burn through it. Debounce, and consider a localStorage cache keyed by rounded
  waypoints — permitted under ODbL, which is a second quiet argument for ORS over Mapbox.
- **Relationship to "close the loop."** §9 defers a Dijkstra pass for a get-me-back button. Both
  features bolt pathfinding onto a click-only design, and deciding them together is likely cheaper
  than deciding them twice.

---

## 6. Milestone

**Milestone 5 at the earliest.** It needs a real graph to be worth building, and every interaction
decision here made against ten test segments would be a guess — the same reasoning that puts admin
before site in `index.md` §8.
