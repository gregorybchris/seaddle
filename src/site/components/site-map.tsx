import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl";
import type { FeatureCollection, LineString } from "geojson";
import { centeredOn } from "@/lib/geo/bounds";
import { projectOntoPolyline } from "@/lib/geo/polyline";
import type { Coord } from "@/lib/models/geo";
import { harderDifficulty, type SegmentId } from "@/lib/models/graph";
import type { SiteGraph } from "../graph-data";
import { RAMPS, type Encoding } from "../filters";
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

type SiteMapProps = {
  graph: SiteGraph;
  route: Route;
  encoding: Encoding;
  /** Roads that fail the filters: dimmed, never hidden. */
  dimmed: SegmentId[];
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
  scrubbed,
  framing,
  onPick,
}: SiteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [overRoad, setOverRoad] = useState(false);

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
          difficulty: harderDifficulty(
            segment.difficulty.forward,
            segment.difficulty.backward,
          ),
          laneQuality: segment.laneQuality,
          scenic: segment.scenic,
          surface: segment.surface,
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
  const color = useMemo(
    () => [
      "match",
      ["get", encoding],
      ...Object.entries(RAMPS[encoding]).flat(),
      "#1c4632",
    ],
    [encoding],
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

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -122.33, latitude: 47.62, zoom: 10 }}
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
      // Only a road is clickable, so only a road says so. Claiming every pixel
      // is clickable teaches a beginner nothing about where they may go.
      cursor={overRoad ? "pointer" : "grab"}
      interactiveLayerIds={[CLICKABLE]}
      onMouseMove={(event: MapLayerMouseEvent) =>
        setOverRoad(Boolean(event.features?.length))
      }
      onMouseOut={() => setOverRoad(false)}
      onClick={(event: MapLayerMouseEvent) => {
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
          id="segments-open"
          type="line"
          filter={["in", ["get", "id"], ["literal", open]]}
          paint={{
            "line-color": color as never,
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
        {/* Surface reads as a set of materials rather than a scale, so it is
            reinforced with a pattern that does not rely on color at all. */}
        <Layer
          id="segments-surface"
          type="line"
          filter={
            encoding === "surface"
              ? ["!=", ["get", "surface"], "asphalt"]
              : ["==", ["get", "id"], ""]
          }
          paint={{
            "line-color": "#faf7f1",
            "line-opacity": 0.85,
            "line-width": 1.5,
            "line-dasharray": [1, 2],
          }}
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
    </Map>
  );
}
