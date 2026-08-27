import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl";
import type { FeatureCollection, LineString } from "geojson";
import { projectOntoPolyline } from "@/lib/geo/polyline";
import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph } from "../graph-data";
import { choiceBounds, continuations, isEmpty, type Route } from "../route";

const CLICKABLE = "segments-hit";

/**
 * How wide the invisible target around each road is, in screen pixels.
 *
 * A four-pixel line is a four-pixel target, which is unreasonable with a mouse
 * and hopeless with a thumb. This is the figure the spec sets for touch, and
 * the ambiguity a band this wide creates — two roads a few metres apart both
 * being hit — is resolved by picking the nearest rather than the first.
 */
const HIT_WIDTH = 22;

type SiteMapProps = {
  graph: SiteGraph;
  route: Route;
  onPick: (id: SegmentId) => void;
};

/**
 * Which road the tap meant, when a wide target caught more than one.
 *
 * Two roads running a few metres apart both fall inside a 22-pixel band, and
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
export function SiteMap({ graph, route, onPick }: SiteMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [overRoad, setOverRoad] = useState(false);

  const data = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: [...graph.segments.values()].map((segment) => ({
        type: "Feature",
        id: segment.id,
        properties: { id: segment.id },
        geometry: {
          type: "LineString",
          coordinates: segment.points as number[][],
        },
      })),
    }),
    [graph],
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
  // when the choices have left the screen — the pick is a deliberate act, and
  // answering it by moving the camera is the point.
  useEffect(() => {
    if (!mapRef.current) return;
    const bounds = choiceBounds(route, graph);
    if (!bounds) return;
    mapRef.current.fitBounds(
      [
        [bounds.minLon, bounds.minLat],
        [bounds.maxLon, bounds.maxLat],
      ],
      // Generous padding so the road just ridden stays partly in frame and the
      // choices do not sit against the edge of the screen.
      { padding: 140, duration: 700, maxZoom: 15 },
    );
  }, [route, graph]);

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
        <Layer
          id="segments-closed"
          type="line"
          paint={{
            "line-color": "#1c4632",
            "line-opacity": 0.16,
            "line-width": 3,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
        <Layer
          id="segments-open"
          type="line"
          filter={["in", ["get", "id"], ["literal", open]]}
          paint={{
            "line-color": "#2f6b48",
            "line-opacity": 0.9,
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
            "line-color": "#d97b2e",
            "line-opacity": 1,
            "line-width": 6,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>
    </Map>
  );
}
