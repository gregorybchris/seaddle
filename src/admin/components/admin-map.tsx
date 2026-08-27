import "mapbox-gl/dist/mapbox-gl.css";
import { useMemo } from "react";
import Map, { Layer, Source, type MapLayerMouseEvent } from "react-map-gl";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { GraphNode, SegmentId } from "@/lib/models/graph";
import type { Track } from "@/lib/models/track";
import {
  EMPTY_LINES,
  lineFeature,
  nodesToGeoJson,
  segmentsToGeoJson,
  tracksToGeoJson,
} from "../admin-geojson";

type AdminMapProps = {
  tracks: Track[];
  nodes: GraphNode[];
  selectedNodeIds: string[];
  geometry: Map<SegmentId, ElevCoord[]>;
  preview: ElevCoord[] | null;
  onMapClick: (coord: Coord) => void;
};

/**
 * A working surface, not the product.
 *
 * Deliberately on a plain light basemap rather than the site's palette: the
 * admin's job is to show where rides overlap and where junctions are, and a
 * styled basemap would compete with exactly the signal being read.
 */
export function AdminMap({
  tracks,
  nodes,
  selectedNodeIds,
  geometry,
  preview,
  onMapClick,
}: AdminMapProps) {
  const trackData = useMemo(() => tracksToGeoJson(tracks), [tracks]);
  const segmentData = useMemo(() => segmentsToGeoJson(geometry), [geometry]);
  const nodeData = useMemo(
    () => nodesToGeoJson(nodes, selectedNodeIds),
    [nodes, selectedNodeIds],
  );
  const previewData = useMemo(
    () =>
      preview
        ? {
            type: "FeatureCollection" as const,
            features: [lineFeature(preview)],
          }
        : EMPTY_LINES,
    [preview],
  );

  return (
    <Map
      initialViewState={{ longitude: -122.33, latitude: 47.62, zoom: 11 }}
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
      cursor="crosshair"
      onClick={(event: MapLayerMouseEvent) =>
        onMapClick([event.lngLat.lng, event.lngLat.lat])
      }
    >
      <Source id="tracks" type="geojson" data={trackData}>
        <Layer
          id="tracks-heat"
          type="line"
          paint={{
            "line-color": "#2f5d3f",
            "line-opacity": 0.18,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              9,
              1,
              14,
              3,
              18,
              6,
            ],
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      <Source id="segments" type="geojson" data={segmentData}>
        <Layer
          id="segments-done"
          type="line"
          paint={{
            "line-color": "#6b8f5e",
            "line-width": 5,
            "line-opacity": 0.95,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      <Source id="preview" type="geojson" data={previewData}>
        <Layer
          id="preview-line"
          type="line"
          paint={{
            "line-color": "#b4531f",
            "line-width": 6,
            "line-opacity": 0.95,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      <Source id="nodes" type="geojson" data={nodeData}>
        <Layer
          id="nodes-circle"
          type="circle"
          paint={{
            "circle-radius": ["case", ["get", "selected"], 8, 5],
            "circle-color": ["case", ["get", "selected"], "#b4531f", "#faf7f1"],
            "circle-stroke-color": "#1f4029",
            "circle-stroke-width": 2,
          }}
        />
      </Source>
    </Map>
  );
}
