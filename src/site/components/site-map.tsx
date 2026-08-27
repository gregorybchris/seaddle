import "mapbox-gl/dist/mapbox-gl.css";
import { MAP_STYLE } from "@/lib/map-style";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { MapTheme } from "@/widgets/map-theme";
import type { SiteGraph } from "../graph-data";
import { PIN_LABELS } from "@/lib/models/graph";
import { PinMark } from "@/widgets/pin-mark";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { humanize } from "@/lib/utilities/words";
import { GRADE_STOPS, isAttribute, RAMPS, type Encoding } from "../filters";
import { gradeRuns } from "../grade";
import type { SitePin } from "../use-graph";
import {
  choiceBounds,
  continuations,
  focusAnchor,
  isEmpty,
  routeBounds,
  type Route,
} from "../route";

const CLICKABLE = "segments-hit";

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
  encoding: Encoding;
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
  framing: { mode: "choices" | "route"; at: number };
  onPick: (id: SegmentId) => void;
};

/**
 * Which road the tap meant, when a wide target caught more than one.
 *
 * Two roads running a few meters apart both fall inside a 22-pixel band, and
 * taking whichever Mapbox listed first would pick by draw order — so it picks
 * by distance instead, which is what the person aiming meant.
 */
function nearestOf(
  event: MapLayerMouseEvent,
  graph: SiteGraph,
): SegmentId | null {
  const hits = (event.features ?? [])
    .map((feature) => String(feature.properties?.id ?? ""))
    .filter(Boolean);
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];

  const at: [number, number] = [event.lngLat.lng, event.lngLat.lat];
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
  encoding,
  dimmed,
  allPins,
  pins,
  scrubbed,
  framing,
  onPick,
}: SiteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [overRoad, setOverRoad] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [zoom, setZoom] = useState(10);
  const [openPin, setOpenPin] = useState<string | null>(null);

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
    const chosen = new Set(pins.map((pin) => pin.id));
    const nearby =
      zoom >= PINS_FROM_ZOOM
        ? allPins.filter((pin) => !chosen.has(pin.id))
        : [];
    return { chosen: pins, nearby };
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

  const open = useMemo(() => [...continuations(route, graph)], [route, graph]);
  const chosen = useMemo(
    () => route.steps.map((step) => step.segment),
    [route],
  );

  // Frame the whole network on arrival. There is no geolocation, so this is
  // the only thing that tells a first-time visitor what is covered.
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.fitBounds(
      [
        [graph.bounds.minLon, graph.bounds.minLat],
        [graph.bounds.maxLon, graph.bounds.maxLat],
      ],
      { padding: 48, duration: 0 },
    );
  }, [graph]);

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
      // Generous padding so the road just ridden stays partly in frame and the
      // choices do not sit against the edge of the screen.
      { padding: 140, duration: 700, maxZoom: 15 },
    );
  }, [framing, route, graph]);

  const opened =
    [...shown.nearby, ...shown.chosen].find((pin) => pin.id === openPin) ??
    null;

  /**
   * What the cursor is over, if it is over a road that can be picked.
   *
   * Resolved with the same nearest-of rule as the click, so what the label
   * describes is always the road a click would take. Reading the first hit
   * instead would let the label name one road and the click take another.
   */
  function roadUnder(event: MapLayerMouseEvent): Hovered | null {
    const id = nearestOf(event, graph);
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
        // compact is the smallest form they allow — tuxc turns it off outright,
        // which is not something to copy.
        attributionControl={false}
        // Only a road is clickable, so only a road says so. Claiming every pixel
        // is clickable teaches a beginner nothing about where they may go.
        cursor={overRoad ? "pointer" : "grab"}
        interactiveLayerIds={[CLICKABLE]}
        onMouseMove={(event: MapLayerMouseEvent) => {
          setOverRoad(Boolean(event.features?.length));
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
        onClick={(event: MapLayerMouseEvent) => {
          setOpenPin(null);
          // A tap fires this without ever hovering, and the label would then sit
          // over the map with nothing under it until something else cleared it.
          setHovered(null);
          const id = nearestOf(event, graph);
          if (id) onPick(id);
        }}
      >
        <Source id="graph" type="geojson" data={data}>
          {/* Out of play: still drawn, so the shape of the network stays
            readable and a dead end is visibly a dead end. */}
          {/* Out of play: still drawn, so the shape of the network stays
            readable and a dead end is visibly a dead end. Roads that fail a
            filter fade further, but are never removed — hiding them would
            break the network into islands with no visible reason. */}
          <Layer
            id="segments-closed"
            type="line"
            paint={{
              "line-color": color as never,
              "line-opacity": (attribute
                ? [
                    "case",
                    ["in", ["get", "id"], ["literal", dimmed]],
                    0.08,
                    0.45,
                  ]
                : 0) as never,
              "line-width": 3,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="segments-open"
            type="line"
            filter={["in", ["get", "id"], ["literal", open]]}
            paint={{
              "line-color": color as never,
              "line-opacity": (attribute
                ? ["case", ["in", ["get", "id"], ["literal", dimmed]], 0.25, 1]
                : 0) as never,
              "line-width": isEmpty(route) ? 3.5 : 4.5,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
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
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="segments-chosen"
            type="line"
            filter={["in", ["get", "id"], ["literal", chosen]]}
            paint={{
              // The route wins over the encoding: it is the subject, and a
              // chosen road has to be findable at a glance.
              "line-color": "#d97b2e",
              "line-opacity": 1,
              "line-width": 6,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
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
                "line-opacity": [
                  "case",
                  ["in", ["get", "id"], ["literal", dimmed]],
                  0.08,
                  0.45,
                ],
                "line-width": 3,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="grade-open"
              type="line"
              beforeId={CLICKABLE}
              filter={["in", ["get", "id"], ["literal", open]]}
              paint={{
                "line-color": gradeColor as never,
                "line-opacity": [
                  "case",
                  ["in", ["get", "id"], ["literal", dimmed]],
                  0.25,
                  1,
                ],
                "line-width": isEmpty(route) ? 3.5 : 4.5,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        )}

        {[...shown.nearby, ...shown.chosen].map((pin) => (
          <Marker key={pin.id} longitude={pin.coord[0]} latitude={pin.coord[1]}>
            {/* Hover on a mouse, tap on a phone — and the two have to be told
              apart. A tap fires the enter handler before the click, so a
              toggle would close what the enter had just opened; hovering is
              therefore limited to pointers that can actually hover. Clicking
              must not fall through to the road underneath either. */}
            <button
              type="button"
              // A button because it does something, and named because Mapbox's
              // own marker wrapper is an image called "Map marker" — nesting an
              // unnamed control inside that would leave a keyboard reader with
              // no idea which pin they were on.
              aria-label={pin.note ?? PIN_LABELS[pin.kind]}
              aria-expanded={openPin === pin.id}
              // Mapbox wraps every marker in a div it calls "Map marker" and
              // gives the image role, which makes anything inside it
              // presentational — so a control in there is both unreachable and
              // invalid. The wrapper is a plain div; this button is the thing.
              ref={(element) => {
                const wrapper = element?.closest(".mapboxgl-marker");
                wrapper?.removeAttribute("role");
                wrapper?.removeAttribute("aria-label");
              }}
              className="focus-visible:ring-blaze block rounded-full focus-visible:ring-2 focus-visible:outline-none"
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setOpenPin(pin.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setOpenPin(null);
              }}
              onFocus={() => setOpenPin(pin.id)}
              onBlur={() => setOpenPin(null)}
              onClick={(event) => {
                event.stopPropagation();
                setOpenPin((current) => (current === pin.id ? null : pin.id));
              }}
            >
              <PinMark
                decorative
                kind={pin.kind}
                className={
                  shown.chosen.includes(pin) ? "h-5 w-5" : "h-4 w-4 opacity-70"
                }
              />
            </button>
          </Marker>
        ))}

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

      <MapTheme mapRef={mapRef} />

      {/* Offset off the cursor so the label never sits under the pointer, and
          thrown to the other side near an edge so it cannot run off the map —
          which it otherwise would, since the map reaches the window. */}
      {hovered && (
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
      )}
    </div>
  );
}
