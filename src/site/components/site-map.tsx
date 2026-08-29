import "mapbox-gl/dist/mapbox-gl.css";
import { MAP_STYLE } from "@/lib/map-style";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  AttributionControl,
  Layer,
  Marker,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl";
import type { FeatureCollection, LineString } from "geojson";
import { boundsOf, centeredOn } from "@/lib/geo/bounds";
import { projectOntoPolyline } from "@/lib/geo/polyline";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph, SitePin } from "../graph-data";
import { PIN_LABELS } from "@/lib/models/graph";
import type { BasemapId } from "@/lib/basemap";
import { useBasemapPaint } from "@/lib/use-basemap";
import { PinMark } from "@/widgets/pin-mark";
import { typingIn } from "@/lib/utilities/keys";
import { prefersReducedMotion } from "@/lib/utilities/motion";
import { useUnits } from "@/lib/use-units";
import { humanize } from "@/lib/utilities/words";
import { GRADE_STOPS, isAttribute, RAMPS, type Encoding } from "../encoding";
import { modeNotice, type Mode } from "../mode";
import { gradeRuns } from "../grade";
import {
  choiceBounds,
  focusAnchor,
  previewOf,
  reachable,
  routeBounds,
  routeStart,
  type Route,
} from "../route";
import type { Framing } from "../use-route-history";
import { PICK } from "../pointing";
import { closedNotice, groundNotice, whyClosed } from "../why-closed";
import { MapNotice, type Notice } from "./map-notice";

/**
 * The two invisible bands a pointer actually hits: one over the segments that
 * can be picked, one over the segments that cannot.
 *
 * Two rather than one, because a hit on either has a different answer — a pick,
 * or an explanation of why not — and because the open band being consulted
 * first is what keeps a closed segment running a few meters away from stealing
 * a click meant for the bright one beside it. Building leaves almost nothing in
 * the closed band now that a pick fills in the way to wherever it lands; what
 * is in it is another island of the network, which genuinely cannot be joined.
 */
const CLICKABLE = "segments-hit";
const CLOSED = "segments-hit-closed";

/** Every line on this map is a segment, and a segment has rounded ends and
 *  corners. */
const ROUNDED = { "line-cap": "round", "line-join": "round" } as const;

/**
 * How wide an in-play segment is drawn.
 *
 * One width now, where building once drew a heavier line mid-route to pick the
 * few continuations out of the network behind them. There is no such few any
 * more — a pick fills in the way to wherever it lands, so nearly every segment
 * is in play — and a whole city drawn at the heavier weight says nothing while
 * making the map harder to read, which is the same reason exploring never used
 * it.
 */
const OPEN_WIDTH = 3.5;

/**
 * How wide the invisible target around each segment is, in screen pixels.
 *
 * A four-pixel line is a four-pixel target, which is unreasonable with a mouse
 * and hopeless with a thumb. This is the figure the spec sets for touch, and
 * the ambiguity a band this wide creates — two segments a few meters apart both
 * being hit — is resolved by picking the nearest rather than the first.
 */
const HIT_WIDTH = 22;

/**
 * The zoom at which points of interest start appearing off-route.
 *
 * Around a neighborhood rather than a city: at the opening view the whole
 * network is on screen and a pin for every fountain would be a rash of marks
 * over segments too small to pick out.
 */
const PINS_FROM_ZOOM = 12.5;

/**
 * What a segment says about itself when the cursor is on it.
 *
 * The map can only be one color at a time, so a rider choosing between two
 * segments can compare them on the attribute currently encoded and has to take
 * the other two on trust. Hovering answers all three at once, plus the two
 * numbers — how far, how much climbing — that decide whether a segment is worth
 * taking at all.
 */
type Hovered = {
  id: SegmentId;
  name: string | null;
  meters: number;
  climb: number;
  steepness: string;
  protection: string;
  surroundings: string;
  x: number;
  y: number;
  /** Whether the label has to sit left of / above the cursor to stay on the
   *  map. */
  flipX: boolean;
  flipY: boolean;
};

/** Roughly the label's footprint, used to decide which side of the cursor it
 *  takes. */
const TIP_WIDTH = 210;
const TIP_HEIGHT = 56;

type SiteMapProps = {
  graph: SiteGraph;
  route: Route;
  /** What a click on a segment means here: add it to the route, or read it. */
  mode: Mode;
  encoding: Encoding;
  /** Which ground to draw everything on. Chosen elsewhere; painted here,
   *  because painting it needs the map instance and choosing it does not. */
  basemap: BasemapId;
  /** Whether a pick moves the camera to the segments that could come next. */
  autoZoom: boolean;
  /** Every point of interest on the graph. */
  allPins: SitePin[];
  /** Those on the segments already chosen, which are shown at any zoom. */
  pins: SitePin[];
  /**
   * Where the reader is pointing on the elevation chart, if anywhere: the point
   * under the pointer, and the stretch of road a drag has covered so far.
   */
  scrubbed: { at: Coord; band: ElevCoord[] | null } | null;
  /**
   * What the map should be showing, and a nonce so asking twice works.
   *
   * "choices" while a route is being built, "route" when one is being looked
   * at — arriving on a shared link, or opening a saved route.
   */
  framing: Framing;
  /** The segment the panel is pointing at, drawn so a keyboard can see where it
   *  is. */
  highlighted: SegmentId | null;
  /** The segment being read while exploring, if any. */
  selected: SegmentId | null;
  onPick: (id: SegmentId) => void;
  /** A segment to read, or nothing when the click landed on the ground. */
  onSelect: (id: SegmentId | null) => void;
  /**
   * Where the map is looking, once it has settled.
   *
   * Before a route starts every segment is a legal first pick, and this is what
   * says which handful of them the panel should offer — panning is how a
   * reader who is not clicking says "around here".
   */
  onCenter: (coord: Coord) => void;
};

/**
 * The segments one of the hit bands caught, which is not the same as the
 * segments caught in total.
 *
 * Sorted by which layer they came from rather than checked against the list of
 * open segments afterwards, because the layers already hold that distinction
 * and asking them is cheaper than asking again.
 */
function hitsIn(event: MapLayerMouseEvent, layer: string): SegmentId[] {
  return (event.features ?? [])
    .filter((feature) => feature.layer?.id === layer)
    .map((feature) => String(feature.properties?.id ?? ""))
    .filter(Boolean);
}

function pointOf(event: MapLayerMouseEvent): [number, number] {
  return [event.lngLat.lng, event.lngLat.lat];
}

/**
 * Which segment the tap meant, when a wide target caught more than one.
 *
 * Two segments running a few meters apart both fall inside a 22-pixel band, and
 * taking whichever Mapbox listed first would pick by draw order — so it picks
 * by distance instead, which is what the person aiming meant.
 */
function nearestOf(
  hits: SegmentId[],
  at: [number, number],
  graph: SiteGraph,
): SegmentId | null {
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];

  let best = hits[0];
  let closest = Infinity;
  for (const id of hits) {
    const segment = graph.segments.get(id);
    if (!segment) continue;
    const away = projectOntoPolyline(segment.points, at).distanceMeters;
    if (away < closest) {
      closest = away;
      best = id;
    }
  }
  return best;
}

/**
 * Two states where there were three: in the route, and everywhere the route can
 * still be ridden to — which, the far islands aside, is the whole map.
 *
 * The third state was the network dimmed down to the handful of segments
 * touching the end of the route, and it was honest but small: reaching a road
 * across town meant zooming in far enough to pick every short segment on the
 * way to it. A pick now carries the route to wherever it lands, so what is
 * clickable is what is drawn, and the only thing left visibly out of play is a
 * piece of the network that no ride connects to this one.
 */
export function SiteMap({
  graph,
  route,
  mode,
  encoding,
  basemap,
  autoZoom,
  allPins,
  pins,
  scrubbed,
  framing,
  highlighted,
  selected,
  onPick,
  onSelect,
  onCenter,
}: SiteMapProps) {
  const exploring = mode === "explore";
  const mapRef = useRef<MapRef>(null);
  useBasemapPaint(mapRef, basemap);
  const wrap = useRef<HTMLDivElement>(null);
  const [overSegment, setOverSegment] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [zoom, setZoom] = useState(10);
  /** Whether the map exists yet, which is not the same as this having
   *  rendered. */
  const [ready, setReady] = useState(false);
  const [openPin, setOpenPin] = useState<string | null>(null);
  /** Why the last tap landed on nothing, if it landed on a segment at all. */
  const [notice, setNotice] = useState<Notice | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  /**
   * Which pins to draw.
   *
   * Every fountain in the city at once buries a view of the whole network, so
   * away from the map they appear only once it is zoomed in far enough to be
   * looking at a neighborhood. Pins on the chosen route show at any zoom: they
   * are part of the route being built rather than scenery around it — and
   * showing them only after a segment is picked would mean a rider could never
   * use a water stop to decide where to go.
   */
  const shown = useMemo(() => {
    const onRoute = new Set(pins.map((pin) => pin.id));
    const nearby =
      zoom >= PINS_FROM_ZOOM
        ? allPins.filter((pin) => !onRoute.has(pin.id))
        : [];
    // Off-route first, so a pin on the route is drawn over one that is not.
    return [...nearby, ...pins].map((pin) => ({
      pin,
      onRoute: onRoute.has(pin.id),
    }));
  }, [pins, allPins, zoom]);

  const data = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: [...graph.segments.values()].map((segment) => ({
        type: "Feature",
        id: segment.id,
        // The attributes travel with the feature, because the color of a
        // segment is decided by a style expression on the GPU rather than in
        // React. Carrying only the id — which this did — left every expression
        // matching against nothing and every segment drawn in the fallback.
        properties: {
          id: segment.id,
          steepness: segment.steepness,
          protection: segment.protection,
          surroundings: segment.surroundings,
        },
        geometry: {
          type: "LineString",
          coordinates: segment.points as number[][],
        },
      })),
    }),
    [graph],
  );

  // A segment is drawn in the color of whatever the map is currently about.
  // Elevation is not one of these: it varies along a segment rather than across
  // segments, so it cannot be a color per feature and is drawn separately
  // below.
  const attribute = isAttribute(encoding) ? encoding : null;
  const color = useMemo(
    () =>
      attribute
        ? [
            "match",
            ["get", attribute],
            ...Object.entries(RAMPS[attribute]).flat(),
            "#1c4632",
          ]
        : "#1c4632",
    [attribute],
  );

  /**
   * The network cut into stretches of even steepness.
   *
   * Built here rather than at compile time because the elevation is already
   * in the geometry that shipped: deriving it costs nothing to download, and a
   * second file would be the same numbers again in a different shape. Only
   * built when it is being looked at — it is several thousand features, and
   * most visits never turn this on.
   */
  const gradeData = useMemo<FeatureCollection<LineString>>(() => {
    if (attribute) return { type: "FeatureCollection", features: [] };
    return {
      type: "FeatureCollection",
      features: [...graph.segments.values()].flatMap((segment) =>
        gradeRuns(segment.points).map((run) => ({
          type: "Feature" as const,
          properties: { id: segment.id, grade: run.grade },
          geometry: {
            type: "LineString" as const,
            coordinates: run.points as number[][],
          },
        })),
      ),
    };
  }, [graph, attribute]);

  /**
   * The stretch of road under a drag on the elevation chart.
   *
   * Its own geometry rather than a filter over the graph: a band is cut at two
   * fractions along the line and stops mid-segment far more often than it lands
   * on a junction, so there is no set of segment ids that describes it.
   */
  const bandData = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: scrubbed?.band
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: scrubbed.band as number[][],
              },
            },
          ]
        : [],
    }),
    [scrubbed],
  );

  // Continuous, so a hill easing off looks like it is easing off.
  const gradeColor = useMemo(
    () => ["interpolate", ["linear"], ["get", "grade"], ...GRADE_STOPS.flat()],
    [],
  );

  /**
   * The segments a click may land on.
   *
   * Both modes now say almost everything. Exploring says everything outright,
   * because nothing is being joined and a rider mid-route has to be able to
   * read a segment that does not continue their route. Building says everything
   * the route could be ridden to, which is the same list minus whichever
   * islands of the network it is not on. The open band, the full-colour lines
   * and the cursor are all filtered on this one list.
   */
  const open = useMemo(
    () =>
      exploring ? [...graph.segments.keys()] : [...reachable(route, graph)],
    [exploring, route, graph],
  );
  const chosen = useMemo(
    () => route.steps.map((step) => step.segment),
    [route],
  );

  /**
   * The segments carrying the dark casing: the route so far, or the one segment
   * being read.
   *
   * One mark for both, because both are the same statement — *this* is what the
   * panel is about — and because it is the mark that does not cost a segment
   * its colour. The route used to be repainted deep forest, which said "chosen"
   * by throwing away the steepness or the bike lane that made it worth
   * choosing; now the route and the segments around it can be compared on the
   * encoding while the route is still obvious.
   *
   * Nothing while exploring with nothing selected, and never both at once: the
   * route is not the subject over there, and casing it as well would give the
   * one segment being read no way to stand out from it.
   */
  const marked = useMemo(
    () => (exploring ? (selected ? [selected] : []) : chosen),
    [exploring, selected, chosen],
  );

  /**
   * The segments drawn in full colour, which is not the same as the segments
   * that can be clicked.
   *
   * The route belongs here whether or not it can be appended to — with the
   * casing carrying "chosen" instead of a repaint, a segment left out of this
   * would be drawn at the faded weight of the network behind it, and the route
   * would come out fainter than the choices leading off it.
   */
  const bright = useMemo(
    () => (exploring ? open : [...new Set([...open, ...chosen])]),
    [exploring, open, chosen],
  );

  /**
   * What the segment under the cursor would add, drawn before it is added.
   *
   * A pick is worth a dozen segments now rather than one, and a map that only
   * says which dozen after the fact is a map asking to be undone. So the way
   * there is ghosted in the route's own casing under the pointer: the same mark
   * the route already wears, at a fraction of its weight, which reads as "this
   * becomes yours" without inventing a fifth thing a line on this map can be.
   *
   * A hover, so a phone gets nothing — there is no gesture there between
   * pointing and picking, and one Undo takes the whole fill back anyway, which
   * is the cheaper answer than asking for a second tap to confirm every pick.
   */
  const under = hovered?.id ?? null;
  const ghosted = useMemo(() => {
    // Keyed on which segment is under the pointer rather than on the label,
    // which carries the cursor's own coordinates and so changes every pixel.
    if (exploring || !under) return [];
    const segment = graph.segments.get(under);
    return segment ? previewOf(route, segment, graph) : [];
  }, [exploring, under, route, graph]);

  /**
   * Which way the segment being read runs, drawn on its two ends.
   *
   * The chart in the panel is one segment laid out left to right, and a line on
   * a map has no visible direction — so without these there is nothing saying
   * which end of it the climb starts from. The same green dot and checkered
   * flag the admin uses, because it is the same question being answered.
   */
  const ends = useMemo(() => {
    const points = selected ? graph.segments.get(selected)?.points : null;
    if (!exploring || !points || points.length < 2) return null;
    return { start: points[0], finish: points[points.length - 1] };
  }, [exploring, selected, graph]);

  /**
   * Where the route being built set off from.
   *
   * Only the start, where a segment being read gets both ends. The far end of a
   * route is where the next pick goes and already has the rider looking at it;
   * the start is a mile behind them and otherwise unmarked, which is what makes
   * it the one worth drawing. Nothing until direction resolves — see
   * `routeStart`.
   */
  const began = useMemo(
    () => (exploring ? null : routeStart(route, graph)),
    [exploring, route, graph],
  );

  /**
   * The segment the link named, if it named one.
   *
   * Read once and held, because its only job is to settle the opening view.
   * Every selection after this one is the reader tapping a segment already on
   * their screen, and refitting the camera around each of those would take the
   * map away from someone who is using it.
   */
  const arrivedOn = useRef(selected);

  // Frame what the link was about on arrival: the segment it named, or the
  // whole network if it named none. There is no geolocation, so the network fit
  // is the only thing that tells a first-time visitor what is covered — and a
  // link to one segment that opened on all of it would be showing them the
  // wrong thing entirely.
  //
  // Waits for the map to say it is there rather than trusting the ref to be
  // populated by the time this runs — it is not, reliably, and the version
  // that only checked for null quietly did nothing at all on a cold load,
  // leaving the opening view wherever `initialViewState` had put it.
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const named = arrivedOn.current
      ? graph.segments.get(arrivedOn.current)?.points
      : null;
    const opening = named && named.length > 1 ? boundsOf(named) : graph.bounds;
    mapRef.current.fitBounds(
      [
        [opening.minLon, opening.minLat],
        [opening.maxLon, opening.maxLat],
      ],
      // Capped, or a link to a hundred meters of side street opens at a zoom
      // where the basemap has run out of things to draw. Nothing near it for
      // the network fit, which sits far below.
      { padding: 48, duration: 0, maxZoom: 15 },
    );
    const middle = mapRef.current.getCenter();
    onCenter([middle.lng, middle.lat]);
  }, [graph, ready, onCenter]);

  /** Whether the opening view belongs to a segment the link named. */
  const openedOnSegment = useRef(selected !== null);

  // Frame where the route can go next, not where it has been.
  //
  // The segment already ridden is settled; the decision in front of the rider
  // is which way to turn, and a view fitted to twenty miles of history leaves
  // the turnings too small to tell apart. Refits on every pick rather than only
  // when the choices have left the screen: the pick is a deliberate act, and
  // answering it by moving the camera is the point.
  //
  // The end of the route is held in the middle of the screen while that
  // happens, so the next choice appears around where the cursor already is
  // rather than somewhere else each time.
  useEffect(() => {
    if (!mapRef.current) return;

    const looking = framing.mode === "route";
    // A rider who turned the camera off still gets a finished route framed —
    // one arriving from a link or off the saved list is being *shown* to them,
    // and leaving it half off the screen would be showing them nothing. What
    // they turned off is the map moving out from under a route they are
    // building, which is the other half of this.
    if (!autoZoom && !looking) return;

    const target = looking
      ? routeBounds(route, graph)
      : choiceBounds(route, graph);
    if (!target) return;

    // A link that named a segment opens on that segment, and a route carried in
    // the same link arrives a beat later — unchecked, it would pull the camera
    // straight off the segment the panel is talking about. Only that first
    // framing gives way; every one after it is something the rider just did.
    if (openedOnSegment.current) {
      openedOnSegment.current = false;
      return;
    }

    const anchor = looking ? null : focusAnchor(route, graph);
    const bounds = anchor ? centeredOn(anchor, target) : target;

    mapRef.current.fitBounds(
      [
        [bounds.minLon, bounds.minLat],
        [bounds.maxLon, bounds.maxLat],
      ],
      {
        // Generous padding so the segment just ridden stays partly in frame and
        // the choices do not sit against the edge of the screen.
        padding: 140,
        // The flight is what says the camera moved rather than cut; for a
        // reader who has asked for less of that, it arrives instead. Where it
        // ends up is identical either way.
        duration: prefersReducedMotion() ? 0 : 700,
        maxZoom: 15,
      },
    );
  }, [framing, route, graph, autoZoom]);

  // No message outlives the route it was about. Undoing back to a junction can
  // make the segment it named perfectly pickable, and a note still insisting
  // otherwise is worse than no note at all.
  useEffect(() => setNotice(null), [route]);

  /**
   * Escape puts the segment down, the way a click on the ground does.
   *
   * Clicking off is the gesture this map already has, and it asks for a bare
   * pixel — which a dense stretch of the network, at the zoom a rider reads a
   * segment at, may not have anywhere in reach. The note goes with it: it is
   * the other thing on screen nobody asked to keep.
   *
   * Only while exploring, where there is something being read. Anything that
   * answers Escape itself — a dialog, the elevation chart mid-drag — says so
   * by preventing the default, and a dialog holds focus besides.
   *
   * Listed in `SHORTCUTS` in the settings dialog, which is the only place this
   * one is named — it hangs off no button. Bind a key here and name it there.
   */
  useEffect(() => {
    if (!exploring) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (typingIn(event.target)) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[role="dialog"]')
      )
        return;

      onSelect(null);
      setNotice(null);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exploring, onSelect]);

  /**
   * Say which mode this now is, every time that changes and never on arrival.
   *
   * Switching modes is the one change here that alters what a click means
   * while showing almost nothing for it: the icon swaps and the panel swaps,
   * and neither says the rules just changed. Nobody has switched anything on
   * the first render, though, so a banner there would be the site explaining
   * itself before it had been asked a question — which is what the panel is
   * for. That goes for a mode restored from the last visit too: it is where
   * the rider left off rather than something they just did.
   *
   * What is remembered is the mode already announced, not whether this has run
   * before. A flag for the first render is spent by the first render — and in
   * development there are two of those against one component, so the guard was
   * gone by the time the second one asked, and the banner it exists to prevent
   * was the one every visit opened with.
   *
   * It replaces whatever was up rather than queueing behind it. A refusal about
   * a segment that just became pickable is the message least worth keeping.
   */
  const announced = useRef(mode);
  useEffect(() => {
    if (announced.current === mode) return;
    announced.current = mode;
    setNotice({
      ...modeNotice(mode, PICK),
      at: Date.now(),
      // A few seconds: this confirms something deliberate rather than teaching
      // a rule, and it is in the way of the map it is describing.
      linger: 4000,
    });
  }, [mode]);

  const opened = shown.find(({ pin }) => pin.id === openPin)?.pin ?? null;

  /**
   * What the cursor is over, if it is over a segment that can be picked.
   *
   * Resolved with the same nearest-of rule as the click, so what the label
   * describes is always the segment a click would take. Reading the first hit
   * instead would let the label name one segment and the click take another.
   */
  function segmentUnder(event: MapLayerMouseEvent): Hovered | null {
    const id = nearestOf(hitsIn(event, CLICKABLE), pointOf(event), graph);
    const segment = id ? graph.segments.get(id) : null;
    if (!segment) return null;

    const box = wrap.current?.getBoundingClientRect();
    return {
      id: segment.id,
      name: segment.name,
      meters: segment.meters,
      // Undirected, like the steepness it agrees with: the bigger of the two
      // climbs, since which way this will be ridden is not decided yet.
      climb: Math.max(segment.gainForward, segment.gainBackward),
      steepness: segment.steepness,
      protection: segment.protection,
      surroundings: segment.surroundings,
      x: event.point.x,
      y: event.point.y,
      flipX: box ? event.point.x + TIP_WIDTH > box.width : false,
      flipY: box ? event.point.y + TIP_HEIGHT > box.height : false,
    };
  }

  return (
    <div ref={wrap} className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -122.33, latitude: 47.62, zoom: 10 }}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        // Collapsed to a single mark rather than removed. Mapbox's terms and
        // OpenStreetMap's licence both require the credit to be shown, and
        // compact is the smallest form they allow — the earlier codebase turns
        // it off outright, which is not something to copy.
        attributionControl={false}
        // Only a segment is clickable, so only a segment says so. Claiming
        // every pixel is clickable teaches a beginner nothing about where they
        // may go.
        cursor={overSegment ? "pointer" : "grab"}
        onLoad={() => setReady(true)}
        interactiveLayerIds={[CLICKABLE, CLOSED]}
        onMouseMove={(event: MapLayerMouseEvent) => {
          // Only the open band counts. A segment that is out of play is now
          // under a hit target too, and answering a hover on it with a pointer
          // and a label would say it can be picked at the moment it cannot.
          setOverSegment(hitsIn(event, CLICKABLE).length > 0);
          setHovered(segmentUnder(event));
        }}
        onMouseOut={() => {
          setOverSegment(false);
          setHovered(null);
        }}
        // The camera moving under a still cursor leaves the label describing
        // whatever used to be there.
        onMove={(event) => {
          setZoom(event.viewState.zoom);
          setHovered(null);
        }}
        // On settling rather than on every frame: the panel's list of nearby
        // segments is read, and a list that reshuffles mid-pan is not.
        onMoveEnd={(event) =>
          onCenter([event.viewState.longitude, event.viewState.latitude])
        }
        onClick={(event: MapLayerMouseEvent) => {
          setOpenPin(null);
          // A tap fires this without ever hovering, and the label would then
          // sit over the map with nothing under it until something else cleared
          // it.
          setHovered(null);
          const at = pointOf(event);

          const picked = nearestOf(hitsIn(event, CLICKABLE), at, graph);

          // Exploring, a segment is something to read rather than something to
          // add, and the ground between segments is how it gets put down again
          // — so a miss is an answer here instead of a refusal to explain.
          if (exploring) {
            onSelect(picked);
            return;
          }

          if (picked) {
            setNotice(null);
            onPick(picked);
            return;
          }

          // Nothing pickable was under the tap. If a segment was, it is on
          // another island of the network, which is the one thing left that a
          // pick cannot reach and the one thing a beginner cannot guess from a
          // line going faint. If no segment was, the ground answers for itself.
          const missed = nearestOf(hitsIn(event, CLOSED), at, graph);
          const reason = missed ? whyClosed(route, missed, graph) : null;
          setNotice({
            ...(reason ? closedNotice(reason) : groundNotice(route)),
            at: Date.now(),
          });
        }}
      >
        <Source id="graph" type="geojson" data={data}>
          {/* What the panel is about, cased in the panel's own dark rather than
            repainted in it. What a segment is colored is the whole of what it has
            to say for itself, so the mark goes underneath and widens it into
            something findable at a glance — which the pale highlighter above
            could not do over a near-white basemap.

            First, so every line on this map draws over it: it is a casing, and
            a casing that covered the grade running along the segment it marks
            would hide the reading it was pointing at. */}
          <Layer
            id="segments-marked"
            type="line"
            filter={["in", ["get", "id"], ["literal", marked]]}
            paint={{
              "line-color": "#12301f",
              "line-opacity": 0.9,
              "line-width": 11,
            }}
            layout={ROUNDED}
          />
          {/* The casing the route would gain, at a third of its weight. Over the
            casing rather than under it so a fill that doubles back over ridden
            road still shows, and under everything else for the same reason the
            casing is: it is a mark about these segments, not a repaint of
            them. */}
          <Layer
            id="segments-ghosted"
            type="line"
            filter={["in", ["get", "id"], ["literal", ghosted]]}
            paint={{
              "line-color": "#12301f",
              "line-opacity": 0.3,
              "line-width": 11,
            }}
            layout={ROUNDED}
          />
          {/* Out of play: still drawn, so the shape of the network stays
            readable and an island is visibly an island. Drawn at no opacity
            at all under the grade encoding, which has its own lines below. */}
          <Layer
            id="segments-closed"
            type="line"
            paint={{
              "line-color": color as never,
              "line-opacity": attribute ? 0.45 : 0,
              "line-width": 3,
            }}
            layout={ROUNDED}
          />
          <Layer
            id="segments-open"
            type="line"
            filter={["in", ["get", "id"], ["literal", bright]]}
            paint={{
              "line-color": color as never,
              "line-opacity": attribute ? 1 : 0,
              "line-width": OPEN_WIDTH,
            }}
            layout={ROUNDED}
          />
          {/* The same wide band over everything that cannot be picked, and
            underneath the one that can. Nothing here is ever selected — it is
            only what lets a tap on a faded segment be answered with a reason
            rather than with silence. */}
          <Layer
            id={CLOSED}
            type="line"
            filter={["!", ["in", ["get", "id"], ["literal", open]]]}
            paint={{
              "line-color": "#000000",
              "line-opacity": 0,
              "line-width": HIT_WIDTH,
            }}
            layout={ROUNDED}
          />
          {/* Invisible and wide: the thing a finger actually has to hit. Only
            what may be picked is in it, so a fat target cannot catch a segment
            that is out of play. */}
          <Layer
            id={CLICKABLE}
            type="line"
            filter={["in", ["get", "id"], ["literal", open]]}
            paint={{
              "line-color": "#000000",
              "line-opacity": 0,
              "line-width": HIT_WIDTH,
            }}
            layout={ROUNDED}
          />
          {/* The segment the panel is pointing at, drawn like a highlighter
              over the top rather than as another color of line: it has to be
              findable without hiding what the segment already says about
              itself, and a keyboard has no cursor to follow. Pale and
              soft-edged so it reads as attention rather than as a fourth state
              of the network. */}
          <Layer
            id="segments-highlighted"
            type="line"
            filter={["==", ["get", "id"], highlighted ?? ""]}
            paint={{
              "line-color": "#e9e0d0",
              "line-opacity": 0.5,
              "line-width": 14,
              "line-blur": 2,
            }}
            layout={ROUNDED}
          />
        </Source>

        {/* The stretch the chart is measuring, in the same pale highlighter the
            panel's own segment gets — it is the same statement, that this is
            what the reader is looking at, and saying it a second way would be a
            second thing to learn. Over the lines rather than cased under them,
            because a band cuts across segments mid-way and a casing would draw
            as a widened piece of one. */}
        <Source id="scrub-band" type="geojson" data={bandData}>
          <Layer
            id="scrub-band-line"
            type="line"
            paint={{
              "line-color": "#e9e0d0",
              "line-opacity": 0.5,
              "line-width": 14,
              "line-blur": 2,
            }}
            layout={ROUNDED}
          />
        </Source>

        {/* Elevation, drawn as its own set of lines rather than as a color on
          the ones above. The steepness of a segment changes along it, and a
          feature can only hold one color, so the segment is cut into stretches
          that are each one steepness. Kept under the hit target and the chosen
          route, so neither picking nor reading your own route is affected. */}
        {!attribute && (
          <Source id="grade" type="geojson" data={gradeData}>
            <Layer
              id="grade-closed"
              type="line"
              beforeId={CLICKABLE}
              paint={{
                "line-color": gradeColor as never,
                "line-opacity": 0.45,
                "line-width": 3,
              }}
              layout={ROUNDED}
            />
            <Layer
              id="grade-open"
              type="line"
              beforeId={CLICKABLE}
              filter={["in", ["get", "id"], ["literal", bright]]}
              paint={{
                "line-color": gradeColor as never,
                "line-opacity": 1,
                "line-width": OPEN_WIDTH,
              }}
              layout={ROUNDED}
            />
          </Source>
        )}

        <PinMarkers pins={shown} openPin={openPin} onOpen={setOpenPin} />

        {opened && (
          <Popup
            longitude={opened.coord[0]}
            latitude={opened.coord[1]}
            anchor="bottom"
            offset={14}
            closeButton={false}
            closeOnClick={false}
            className="pin-popup"
            onClose={() => setOpenPin(null)}
          >
            <p className="text-sand text-xs leading-relaxed">
              {opened.note ?? PIN_LABELS[opened.kind]}
            </p>
            {opened.note && (
              <p className="eyebrow text-sand/70 mt-1">
                {PIN_LABELS[opened.kind]}
              </p>
            )}
          </Popup>
        )}

        {/* Which end of the segment the chart in the panel starts from. The
            green dot and the flag are the admin's, unchanged: it is the same
            question — which way does this line run — and answering it two ways
            would be two things to learn instead of one. */}
        {ends && (
          <>
            <Marker longitude={ends.start[0]} latitude={ends.start[1]}>
              <span
                aria-label="Segment start"
                className="border-forest-deep bg-moss block h-3.5 w-3.5 rounded-full border-2 shadow"
              />
            </Marker>
            <Marker longitude={ends.finish[0]} latitude={ends.finish[1]}>
              <span aria-label="Segment finish" className="checkered block" />
            </Marker>
          </>
        )}

        {began && (
          <Marker longitude={began[0]} latitude={began[1]}>
            <span
              aria-label="Route start"
              className="border-forest-deep bg-moss block h-3.5 w-3.5 rounded-full border-2 shadow"
            />
          </Marker>
        )}

        {/* The same place the chart is reporting, so a height on the graph has
            a somewhere on the map. Dark core, pale ring — deliberately not the
            chart's amber, because the route it sits on is amber and a marker
            has to be visible against the thing it marks. */}
        {scrubbed && (
          <Marker longitude={scrubbed.at[0]} latitude={scrubbed.at[1]}>
            <span
              aria-hidden
              className="bg-forest-deep border-paper block h-3.5 w-3.5 rounded-full border-2 shadow-[0_1px_4px_rgba(18,48,31,0.55)]"
            />
          </Marker>
        )}
        <AttributionControl compact />
      </Map>

      {hovered && <SegmentTip hovered={hovered} />}
      <MapNotice notice={notice} onDone={clearNotice} />
    </div>
  );
}

/**
 * The points of interest currently on the map.
 *
 * Hover on a mouse, tap on a phone — and the two have to be told apart. A tap
 * fires the enter handler before the click, so a toggle would close what the
 * enter had just opened; hovering is therefore limited to pointers that can
 * actually hover. Clicking must not fall through to the segment underneath
 * either.
 */
function PinMarkers({
  pins,
  openPin,
  onOpen,
}: {
  pins: { pin: SitePin; onRoute: boolean }[];
  openPin: string | null;
  onOpen: (id: string | null) => void;
}) {
  return pins.map(({ pin, onRoute }) => (
    <Marker key={pin.id} longitude={pin.coord[0]} latitude={pin.coord[1]}>
      <button
        type="button"
        // A button because it does something, and named because Mapbox's own
        // marker wrapper is an image called "Map marker" — nesting an unnamed
        // control inside that would leave a keyboard reader with no idea which
        // pin they were on.
        aria-label={pin.note ?? PIN_LABELS[pin.kind]}
        aria-expanded={openPin === pin.id}
        // Mapbox wraps every marker in a div it calls "Map marker" and gives
        // the image role, which makes anything inside it presentational — so a
        // control in there is both unreachable and invalid. The wrapper is a
        // plain div; this button is the thing.
        ref={(element) => {
          const wrapper = element?.closest(".mapboxgl-marker");
          wrapper?.removeAttribute("role");
          wrapper?.removeAttribute("aria-label");
        }}
        className="focus-visible:ring-blaze block rounded-full focus-visible:ring-2 focus-visible:outline-none"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") onOpen(pin.id);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") onOpen(null);
        }}
        onFocus={() => onOpen(pin.id)}
        onBlur={() => onOpen(null)}
        onClick={(event) => {
          event.stopPropagation();
          onOpen(openPin === pin.id ? null : pin.id);
        }}
      >
        {/* A pin on the route is drawn full strength, one merely nearby is
            smaller and faded: the route is the subject and the rest is
            context. */}
        <PinMark
          decorative
          kind={pin.kind}
          className={onRoute ? "h-5 w-5" : "h-4 w-4 opacity-70"}
        />
      </button>
    </Marker>
  ));
}

/**
 * What the segment under the cursor says about itself.
 *
 * Offset off the cursor so the label never sits under the pointer, and thrown
 * to the other side near an edge so it cannot run off the map — which it
 * otherwise would, since the map reaches the window.
 */
function SegmentTip({ hovered }: { hovered: Hovered }) {
  const { distance, climb } = useUnits();

  return (
    <div
      style={{
        left: hovered.x + (hovered.flipX ? -14 : 14),
        top: hovered.y + (hovered.flipY ? -14 : 14),
        transform: `translate(${hovered.flipX ? "-100%" : "0"}, ${
          hovered.flipY ? "-100%" : "0"
        })`,
      }}
      className="border-forest-deep bg-forest text-sand pointer-events-none absolute z-10 rounded-md border px-2 py-1.5 shadow-lg"
    >
      {hovered.name && (
        <p className="max-w-56 truncate text-xs">{hovered.name}</p>
      )}
      <p className="tabular text-sand/70 text-[0.6875rem] whitespace-nowrap">
        {distance(hovered.meters)} · <span className="text-sand mr-0.5">↑</span>
        {climb(hovered.climb)}
      </p>
      <p className="text-sand/70 text-[0.6875rem] whitespace-nowrap">
        {humanize(hovered.steepness)} · {humanize(hovered.protection)} ·{" "}
        {humanize(hovered.surroundings)}
      </p>
    </div>
  );
}
