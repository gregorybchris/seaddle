import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl";
import type { FeatureCollection, LineString } from "geojson";
import { boundsOf } from "@/lib/geo/bounds";
import type { SegmentId } from "@/lib/models/graph";
import type { SiteGraph } from "../graph-data";
import { continuations, isEmpty, type Route } from "../route";

const CLICKABLE = "segments-open";

type SiteMapProps = {
  graph: SiteGraph;
  route: Route;
  onPick: (id: SegmentId) => void;
};

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

  // Follow a growing route, but only when it has actually left the screen.
  // Refitting every time would drag the map back from wherever the rider had
  // just panned to look, which is worse than occasionally having to pan.
  useEffect(() => {
    if (!mapRef.current || route.steps.length < 2) return;
    const points = route.steps.flatMap(
      (step) => graph.segments.get(step.segment)?.points ?? [],
    );
    if (points.length === 0) return;

    const bounds = boundsOf(points);
    const view = mapRef.current.getMap().getBounds();
    const visible =
      view &&
      view.contains([bounds.minLon, bounds.minLat]) &&
      view.contains([bounds.maxLon, bounds.maxLat]);
    if (visible) return;

    mapRef.current.fitBounds(
      [
        [bounds.minLon, bounds.minLat],
        [bounds.maxLon, bounds.maxLat],
      ],
      { padding: 90, duration: 700, maxZoom: 15 },
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
        const id = event.features?.[0]?.properties?.id;
        if (id) onPick(String(id));
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
          id={CLICKABLE}
          type="line"
          filter={["in", ["get", "id"], ["literal", open]]}
          paint={{
            "line-color": "#2f6b48",
            "line-opacity": 0.9,
            "line-width": isEmpty(route) ? 3.5 : 4.5,
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
