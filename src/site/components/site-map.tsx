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
import { centeredOn } from "@/lib/geo/bounds";
import { projectOntoPolyline } from "@/lib/geo/polyline";
import type { Coord } from "@/lib/models/geo";
import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph, SitePin } from "../graph-data";
import { PIN_LABELS } from "@/lib/models/graph";
import type { BasemapId } from "@/lib/basemap";
import { useBasemapPaint } from "@/lib/use-basemap";
import { PinMark } from "@/widgets/pin-mark";
import { prefersReducedMotion } from "@/lib/utilities/motion";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { humanize } from "@/lib/utilities/words";
import { GRADE_STOPS, isAttribute, RAMPS, type Encoding } from "../encoding";
import { modeNotice, type Mode } from "../mode";
import { gradeRuns } from "../grade";
import {
  choiceBounds,
  continuations,
  focusAnchor,
  isEmpty,
  routeBounds,
  type Route,
} from "../route";
import type { Framing } from "../use-route-history";
import { PICK } from "../pointing";
import { closedNotice, whyClosed } from "../why-closed";
import { MapNotice, type Notice } from "./map-notice";

/**
 * The two invisible bands a pointer actually hits: one over the roads that can
 * be picked, one over the roads that cannot.
 *
 * Two rather than one, because a hit on either has a different answer — a pick,
 * or an explanation of why not — and because the open band being consulted
 * first is what keeps a closed road running a few meters away from stealing a
 * click meant for the bright one beside it.
 */
const CLICKABLE = "segments-hit";
const CLOSED = "segments-hit-closed";

/** Every line on this map is a road, and a road has rounded ends and corners. */
const ROUNDED = { "line-cap": "round", "line-join": "round" } as const;

/**
 * How faintly a road that failed a filter is drawn.
 *
 * The same rule for the network and for the grade lines over it, because they
 * are two drawings of the same roads and a filter has to reach both. Dimming
 * rather than hiding: a removed road would break the network into islands with
 * no visible reason.
 */
function dimming(dimmed: SegmentId[], faded: number, full: number) {
  return ["case", ["in", ["get", "id"], ["literal", dimmed]], faded, full];
}

/**
 * Wider once a ride is under way, when the open roads are the few to pick from.
 *
 * Never while exploring: there every road is open, so the wider line would say
 * nothing about which ones are in play and only make a map of the whole network
 * heavier to read.
 */
function openWidth(route: Route, exploring: boolean): number {
  return exploring || isEmpty(route) ? 3.5 : 4.5;
}

/**
 * How wide the invisible target around each road is, in screen pixels.
 *
 * A four-pixel line is a four-pixel target, which is unreasonable with a mouse
 * and hopeless with a thumb. This is the figure the spec sets for touch, and
 * the ambiguity a band this wide creates — two roads a few meters apart both
 * being hit — is resolved by picking the nearest rather than the first.
 */
const HIT_WIDTH = 22;

/**
 * The zoom at which points of interest start appearing off-route.
 *
 * Around a neighborhood rather than a city: at the opening view the whole
 * network is on screen and a pin for every fountain would be a rash of marks
 * over roads too small to pick out.
 */
const PINS_FROM_ZOOM = 12.5;

/**
 * What a road says about itself when the cursor is on it.
 *
 * The map can only be one color at a time, so a rider choosing between two
 * roads can compare them on the attribute currently encoded and has to take
 * the other two on trust. Hovering answers all three at once, plus the two
 * numbers — how far, how much climbing — that decide whether a road is worth
 * taking at all.
 */
type Hovered = {
  name: string | null;
  meters: number;
  climb: number;
  steepness: string;
  protection: string;
  surroundings: string;
  x: number;
  y: number;
  /** Whether the label has to sit left of / above the cursor to stay on the map. */
  flipX: boolean;
  flipY: boolean;
};

/** Roughly the label's footprint, used to decide which side of the cursor it takes. */
const TIP_WIDTH = 210;
const TIP_HEIGHT = 56;

type SiteMapProps = {
  graph: SiteGraph;
  route: Route;
  /** What a click on a road means here: add it to the ride, or read it. */
  mode: Mode;
  encoding: Encoding;
  /** Which ground to draw everything on. Chosen elsewhere; painted here,
   *  because painting it needs the map instance and choosing it does not. */
  basemap: BasemapId;
  /** Roads that fail the filters: dimmed, never hidden. */
  dimmed: SegmentId[];
  /** Every point of interest on the graph. */
  allPins: SitePin[];
  /** Those on the roads already chosen, which are shown at any zoom. */
  pins: SitePin[];
  /** Where the reader is pointing on the elevation chart, if anywhere. */
  scrubbed: Coord | null;
  /**
   * What the map should be showing, and a nonce so asking twice works.
   *
   * "choices" while a route is being built, "route" when one is being looked
   * at — arriving on a shared link, or opening a saved ride.
   */
  framing: Framing;
  /** The road the panel is pointing at, drawn so a keyboard can see where it is. */
  highlighted: SegmentId | null;
  /** The road being read while exploring, if any. */
  selected: SegmentId | null;
  onPick: (id: SegmentId) => void;
  /** A road to read, or nothing when the click landed on the ground. */
  onSelect: (id: SegmentId | null) => void;
  /**
   * Where the map is looking, once it has settled.
   *
   * Before a ride starts every road is a legal first pick, and this is what
   * says which handful of them the panel should offer — panning is how a
   * reader who is not clicking says "around here".
   */
  onCenter: (coord: Coord) => void;
};

/**
 * The roads one of the hit bands caught, which is not the same as the roads
 * caught in total.
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
 * Which road the tap meant, when a wide target caught more than one.
 *
 * Two roads running a few meters apart both fall inside a 22-pixel band, and
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
 * Three states and only three: in the route, a place it could go next, and
 * everything else.
 *
 * A beginner should never have to wonder which click is legal, so what is
 * clickable is what is bright, and what is not is visibly out of play rather
 * than merely unresponsive.
 */
export function SiteMap({
  graph,
  route,
  mode,
  encoding,
  basemap,
  dimmed,
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
  const [overRoad, setOverRoad] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [zoom, setZoom] = useState(10);
  /** Whether the map exists yet, which is not the same as this having rendered. */
  const [ready, setReady] = useState(false);
  const [openPin, setOpenPin] = useState<string | null>(null);
  /** Why the last tap landed on nothing, if it landed on a road at all. */
  const [notice, setNotice] = useState<Notice | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  /**
   * Which pins to draw.
   *
   * Every fountain in the city at once buries a view of the whole network, so
   * away from the map they appear only once it is zoomed in far enough to be
   * looking at a neighborhood. Pins on the chosen route show at any zoom: they
   * are part of the ride being built rather than scenery around it — and
   * showing them only after a road is picked would mean a rider could never use
   * a water stop to decide where to go.
   */
  const shown = useMemo(() => {
    const onRoute = new Set(pins.map((pin) => pin.id));
    const nearby =
      zoom >= PINS_FROM_ZOOM
        ? allPins.filter((pin) => !onRoute.has(pin.id))
        : [];
    // Off-route first, so a pin on the ride is drawn over one that is not.
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
        // The attributes travel with the feature, because the color of a road
        // is decided by a style expression on the GPU rather than in React.
        // Carrying only the id — which this did — left every expression
        // matching against nothing and every road drawn in the fallback.
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

  // A road is drawn in the color of whatever the map is currently about.
  // Elevation is not one of these: it varies along a road rather than across
  // roads, so it cannot be a color per feature and is drawn separately below.
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

  // Continuous, so a hill easing off looks like it is easing off.
  const gradeColor = useMemo(
    () => ["interpolate", ["linear"], ["get", "grade"], ...GRADE_STOPS.flat()],
    [],
  );

  /**
   * The roads a click may land on.
   *
   * Exploring drops the rule that a route has to join up, because nothing is
   * being joined: the whole network goes live, which is the only way a rider
   * mid-route can read a road that does not happen to continue it. That falls
   * straight out of the layers — the open band, the bright lines and the wider
   * stroke are all filtered on this one list.
   */
  const open = useMemo(
    () =>
      exploring ? [...graph.segments.keys()] : [...continuations(route, graph)],
    [exploring, route, graph],
  );
  const chosen = useMemo(
    () => route.steps.map((step) => step.segment),
    [route],
  );

  /**
   * The roads carrying the dark casing: the ride so far, or the one road being
   * read.
   *
   * One mark for both, because both are the same statement — *this* is what the
   * panel is about — and because it is the mark that does not cost a road its
   * colour. The route used to be repainted deep forest, which said "chosen" by
   * throwing away the steepness or the bike lane that made it worth choosing;
   * now the ride and the roads around it can be compared on the encoding while
   * the ride is still obvious.
   *
   * Nothing while exploring with nothing selected, and never both at once: the
   * ride is not the subject over there, and casing it as well would give the
   * one road being read no way to stand out from it.
   */
  const marked = useMemo(
    () => (exploring ? (selected ? [selected] : []) : chosen),
    [exploring, selected, chosen],
  );

  /**
   * The roads drawn in full colour, which is not the same as the roads that
   * can be clicked.
   *
   * The ride belongs here whether or not it can be appended to — with the
   * casing carrying "chosen" instead of a repaint, a road left out of this
   * would be drawn at the faded weight of the network behind it, and the route
   * would come out fainter than the choices leading off it.
   */
  const bright = useMemo(
    () => (exploring ? open : [...new Set([...open, ...chosen])]),
    [exploring, open, chosen],
  );

  /**
   * Which way the road being read runs, drawn on its two ends.
   *
   * The chart in the panel is one road laid out left to right, and a line on a
   * map has no visible direction — so without these there is nothing saying
   * which end of it the climb starts from. The same green dot and checkered
   * flag the admin uses, because it is the same question being answered.
   */
  const ends = useMemo(() => {
    const points = selected ? graph.segments.get(selected)?.points : null;
    if (!exploring || !points || points.length < 2) return null;
    return { start: points[0], finish: points[points.length - 1] };
  }, [exploring, selected, graph]);

  // Frame the whole network on arrival. There is no geolocation, so this is
  // the only thing that tells a first-time visitor what is covered.
  //
  // Waits for the map to say it is there rather than trusting the ref to be
  // populated by the time this runs — it is not, reliably, and the version
  // that only checked for null quietly did nothing at all on a cold load,
  // leaving the opening view wherever `initialViewState` had put it.
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    mapRef.current.fitBounds(
      [
        [graph.bounds.minLon, graph.bounds.minLat],
        [graph.bounds.maxLon, graph.bounds.maxLat],
      ],
      { padding: 48, duration: 0 },
    );
    const middle = mapRef.current.getCenter();
    onCenter([middle.lng, middle.lat]);
  }, [graph, ready, onCenter]);

  // Frame where the route can go next, not where it has been.
  //
  // The road already ridden is settled; the decision in front of the rider is
  // which way to turn, and a view fitted to twenty miles of history leaves the
  // turnings too small to tell apart. Refits on every pick rather than only
  // when the choices have left the screen: the pick is a deliberate act, and
  // answering it by moving the camera is the point.
  //
  // The end of the route is held in the middle of the screen while that
  // happens, so the next choice appears around where the cursor already is
  // rather than somewhere else each time.
  useEffect(() => {
    if (!mapRef.current) return;

    const looking = framing.mode === "route";
    const target = looking
      ? routeBounds(route, graph)
      : choiceBounds(route, graph);
    if (!target) return;

    const anchor = looking ? null : focusAnchor(route, graph);
    const bounds = anchor ? centeredOn(anchor, target) : target;

    mapRef.current.fitBounds(
      [
        [bounds.minLon, bounds.minLat],
        [bounds.maxLon, bounds.maxLat],
      ],
      {
        // Generous padding so the road just ridden stays partly in frame and
        // the choices do not sit against the edge of the screen.
        padding: 140,
        // The flight is what says the camera moved rather than cut; for a
        // reader who has asked for less of that, it arrives instead. Where it
        // ends up is identical either way.
        duration: prefersReducedMotion() ? 0 : 700,
        maxZoom: 15,
      },
    );
  }, [framing, route, graph]);

  // No message outlives the ride it was about. Undoing back to a junction can
  // make the road it named perfectly pickable, and a note still insisting
  // otherwise is worse than no note at all.
  useEffect(() => setNotice(null), [route]);

  /**
   * Say which mode this now is, every time that changes and never on arrival.
   *
   * Switching modes is the one change here that alters what a click means
   * while showing almost nothing for it: the icon swaps and the panel swaps,
   * and neither says the rules just changed. Nobody has switched anything on
   * the first render, though, so a banner there would be the site explaining
   * itself before it had been asked a question — which is what the panel is
   * for.
   *
   * It replaces whatever was up rather than queueing behind it. A refusal
   * about a road that just became pickable is the message least worth keeping.
   */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
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
   * What the cursor is over, if it is over a road that can be picked.
   *
   * Resolved with the same nearest-of rule as the click, so what the label
   * describes is always the road a click would take. Reading the first hit
   * instead would let the label name one road and the click take another.
   */
  function roadUnder(event: MapLayerMouseEvent): Hovered | null {
    const id = nearestOf(hitsIn(event, CLICKABLE), pointOf(event), graph);
    const segment = id ? graph.segments.get(id) : null;
    if (!segment) return null;

    const box = wrap.current?.getBoundingClientRect();
    return {
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
        // Only a road is clickable, so only a road says so. Claiming every pixel
        // is clickable teaches a beginner nothing about where they may go.
        cursor={overRoad ? "pointer" : "grab"}
        onLoad={() => setReady(true)}
        interactiveLayerIds={[CLICKABLE, CLOSED]}
        onMouseMove={(event: MapLayerMouseEvent) => {
          // Only the open band counts. A road that is out of play is now under
          // a hit target too, and answering a hover on it with a pointer and a
          // label would say it can be picked at the moment it cannot.
          setOverRoad(hitsIn(event, CLICKABLE).length > 0);
          setHovered(roadUnder(event));
        }}
        onMouseOut={() => {
          setOverRoad(false);
          setHovered(null);
        }}
        // The camera moving under a still cursor leaves the label describing
        // whatever used to be there.
        onMove={(event) => {
          setZoom(event.viewState.zoom);
          setHovered(null);
        }}
        // On settling rather than on every frame: the panel's list of nearby
        // roads is read, and a list that reshuffles mid-pan is not.
        onMoveEnd={(event) =>
          onCenter([event.viewState.longitude, event.viewState.latitude])
        }
        onClick={(event: MapLayerMouseEvent) => {
          setOpenPin(null);
          // A tap fires this without ever hovering, and the label would then sit
          // over the map with nothing under it until something else cleared it.
          setHovered(null);
          const at = pointOf(event);

          const picked = nearestOf(hitsIn(event, CLICKABLE), at, graph);

          // Exploring, a road is something to read rather than something to
          // add, and the ground between roads is how it gets put down again —
          // so a miss is an answer here instead of a refusal to explain.
          if (exploring) {
            onSelect(picked);
            return;
          }

          if (picked) {
            setNotice(null);
            onPick(picked);
            return;
          }

          // Nothing pickable was under the tap. If a road was, say why it did
          // nothing — that a route has to join up is the one rule of this map,
          // and a beginner has no way to guess it from a line going faint.
          const missed = nearestOf(hitsIn(event, CLOSED), at, graph);
          const reason = missed ? whyClosed(route, missed, graph) : null;
          setNotice(
            missed && reason
              ? {
                  ...closedNotice(reason, route, dimmed.includes(missed)),
                  at: Date.now(),
                }
              : null,
          );
        }}
      >
        <Source id="graph" type="geojson" data={data}>
          {/* What the panel is about, cased in the panel's own dark rather than
            repainted in it. What a road is colored is the whole of what it has
            to say for itself, so the mark goes underneath and widens it into
            something findable at a glance — which the pale highlighter above
            could not do over a near-white basemap.

            First, so every line on this map draws over it: it is a casing, and
            a casing that covered the grade running along the road it marks
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
          {/* Out of play: still drawn, so the shape of the network stays
            readable and a dead end is visibly a dead end. Drawn at no opacity
            at all under the grade encoding, which has its own lines below. */}
          <Layer
            id="segments-closed"
            type="line"
            paint={{
              "line-color": color as never,
              "line-opacity": (attribute
                ? dimming(dimmed, 0.08, 0.45)
                : 0) as never,
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
              "line-opacity": (attribute
                ? dimming(dimmed, 0.25, 1)
                : 0) as never,
              "line-width": openWidth(route, exploring),
            }}
            layout={ROUNDED}
          />
          {/* The same wide band over everything that cannot be picked, and
            underneath the one that can. Nothing here is ever selected — it is
            only what lets a tap on a faded road be answered with a reason
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
            what may be picked is in it, so a fat target cannot catch a road
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
          {/* The road the panel is pointing at, drawn like a highlighter over
            the top rather than as another color of line: it has to be findable
            without hiding what the road already says about itself, and a
            keyboard has no cursor to follow. Pale and soft-edged so it reads
            as attention rather than as a fourth state of the network. */}
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

        {/* Elevation, drawn as its own set of lines rather than as a color on
          the ones above. The steepness of a road changes along it, and a
          feature can only hold one color, so the road is cut into stretches
          that are each one steepness. Kept under the hit target and the chosen
          route, so neither picking nor reading your own ride is affected. */}
        {!attribute && (
          <Source id="grade" type="geojson" data={gradeData}>
            <Layer
              id="grade-closed"
              type="line"
              beforeId={CLICKABLE}
              paint={{
                "line-color": gradeColor as never,
                "line-opacity": dimming(dimmed, 0.08, 0.45) as never,
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
                "line-opacity": dimming(dimmed, 0.25, 1) as never,
                "line-width": openWidth(route, exploring),
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

        {/* Which end of the road the chart in the panel starts from. The green
          dot and the flag are the admin's, unchanged: it is the same question
          — which way does this line run — and answering it two ways would be
          two things to learn instead of one. */}
        {ends && (
          <>
            <Marker longitude={ends.start[0]} latitude={ends.start[1]}>
              <span
                aria-label="Road start"
                className="border-forest-deep bg-moss block h-3.5 w-3.5 rounded-full border-2 shadow"
              />
            </Marker>
            <Marker longitude={ends.finish[0]} latitude={ends.finish[1]}>
              <span aria-label="Road finish" className="checkered block" />
            </Marker>
          </>
        )}

        {/* The same place the chart is reporting, so a height on the graph has a
          somewhere on the map.
          Dark core, pale ring — deliberately not the chart's amber, because the
          route it sits on is amber and a marker has to be visible against the
          thing it marks. */}
        {scrubbed && (
          <Marker longitude={scrubbed[0]} latitude={scrubbed[1]}>
            <span
              aria-hidden
              className="bg-forest-deep border-paper block h-3.5 w-3.5 rounded-full border-2 shadow-[0_1px_4px_rgba(18,48,31,0.55)]"
            />
          </Marker>
        )}
        <AttributionControl compact />
      </Map>

      {hovered && <RoadTip hovered={hovered} />}
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
 * actually hover. Clicking must not fall through to the road underneath either.
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
        {/* A pin on the ride is drawn full strength, one merely nearby is
            smaller and faded: the ride is the subject and the rest is context. */}
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
 * What the road under the cursor says about itself.
 *
 * Offset off the cursor so the label never sits under the pointer, and thrown
 * to the other side near an edge so it cannot run off the map — which it
 * otherwise would, since the map reaches the window.
 */
function RoadTip({ hovered }: { hovered: Hovered }) {
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
        {formatMiles(hovered.meters)} · ↑{formatFeet(hovered.climb)}
      </p>
      <p className="text-sand/70 text-[0.6875rem] whitespace-nowrap">
        {humanize(hovered.steepness)} · {humanize(hovered.protection)} ·{" "}
        {humanize(hovered.surroundings)}
      </p>
    </div>
  );
}
