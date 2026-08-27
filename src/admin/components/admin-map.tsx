import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl";
import type { Bounds, Coord, ElevCoord } from "@/lib/models/geo";
import type { GraphNode, SegmentId, SegmentRecord } from "@/lib/models/graph";
import type { Track } from "@/lib/models/track";
import { cn } from "@/lib/utilities/style-utils";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import {
  EMPTY_LINES,
  lineFeature,
  nodesToGeoJson,
  segmentsToGeoJson,
  tracksToGeoJson,
} from "../admin-geojson";

const SEGMENT_LAYER = "segments-done";

type Hovered = {
  id: string;
  name: string | null;
  meters: number;
  gain: number;
  x: number;
  y: number;
  /** Whether the label has to sit left of / above the cursor to stay on the map. */
  flipX: boolean;
  flipY: boolean;
};

/** Roughly the label's footprint, used to decide which side of the cursor it takes. */
const TIP_WIDTH = 240;
const TIP_HEIGHT = 60;

type AdminMapProps = {
  tracks: Track[];
  nodes: GraphNode[];
  selectedNodeIds: string[];
  segments: SegmentRecord[];
  geometry: Map<SegmentId, ElevCoord[]>;
  preview: ElevCoord[] | null;
  selectedSegmentId: string | null;
  /** Somewhere to fly to. A fresh object each time, so asking twice works. */
  focus: { bounds: Bounds; maxZoom?: number } | null;
  onMapClick: (coord: Coord, segmentId: string | null) => void;
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
  segments,
  geometry,
  preview,
  selectedSegmentId,
  focus,
  onMapClick,
}: AdminMapProps) {
  const mapRef = useRef<MapRef>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [labelled, setLabelled] = useState(false);

  const trackData = useMemo(() => tracksToGeoJson(tracks), [tracks]);
  const segmentData = useMemo(
    () => segmentsToGeoJson(segments, geometry),
    [segments, geometry],
  );
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

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.fitBounds(
      [
        [focus.bounds.minLon, focus.bounds.minLat],
        [focus.bounds.maxLon, focus.bounds.maxLat],
      ],
      { padding: 80, duration: 900, maxZoom: focus.maxZoom ?? 16 },
    );
  }, [focus]);

  /** What the cursor is over, if it is over a mapped segment. */
  function segmentUnder(event: MapLayerMouseEvent): Hovered | null {
    const feature = event.features?.[0];
    const properties = feature?.properties;
    if (!properties?.id) return null;
    const box = wrap.current?.getBoundingClientRect();
    return {
      id: String(properties.id),
      name: properties.name ? String(properties.name) : null,
      meters: Number(properties.meters ?? 0),
      gain: Number(properties.gainForward ?? 0),
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
        initialViewState={{ longitude: -122.33, latitude: 47.62, zoom: 11 }}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
        cursor={hovered ? "pointer" : "crosshair"}
        interactiveLayerIds={[SEGMENT_LAYER]}
        onMouseMove={(event: MapLayerMouseEvent) =>
          setHovered(segmentUnder(event))
        }
        onMouseLeave={() => setHovered(null)}
        onClick={(event: MapLayerMouseEvent) =>
          onMapClick(
            [event.lngLat.lng, event.lngLat.lat],
            segmentUnder(event)?.id ?? null,
          )
        }
      >
        <Source id="tracks" type="geojson" data={trackData}>
          <Layer
            id="tracks-heat"
            type="line"
            paint={{
              "line-color": "#1c4632",
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
            id={SEGMENT_LAYER}
            type="line"
            paint={{
              "line-color": "#86a874",
              "line-width": 5,
              "line-opacity": 0.95,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          {/* Filtered rather than restyled, so selecting a segment does not
              re-upload the whole source. */}
          <Layer
            id="segments-selected"
            type="line"
            filter={["==", ["get", "id"], selectedSegmentId ?? ""]}
            paint={{
              "line-color": "#d97b2e",
              "line-width": 7,
              "line-opacity": 1,
            }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="segments-labels"
            type="symbol"
            layout={{
              "symbol-placement": "line-center",
              // The id is what identifies a segment when zoomed out; once
              // there is room, the name someone gave it says more.
              "text-field": [
                "step",
                ["zoom"],
                ["get", "id"],
                14,
                ["coalesce", ["get", "name"], ["get", "id"]],
              ],
              "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
              "text-size": 11,
              // Placed along the line but drawn upright: a short id turned on
              // its side to follow a north-south road is markedly harder to
              // read than the same id sitting level next to it.
              "text-rotation-alignment": "viewport",
              "text-allow-overlap": false,
              visibility: labelled ? "visible" : "none",
            }}
            paint={{
              "text-color": "#12301f",
              "text-halo-color": "#faf7f1",
              "text-halo-width": 1.5,
            }}
          />
        </Source>

        <Source id="preview" type="geojson" data={previewData}>
          <Layer
            id="preview-line"
            type="line"
            paint={{
              "line-color": "#d97b2e",
              "line-width": 6,
              "line-opacity": 1,
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
              "circle-color": [
                "case",
                ["get", "selected"],
                "#d97b2e",
                "#faf7f1",
              ],
              "circle-stroke-color": "#12301f",
              "circle-stroke-width": 2,
            }}
          />
        </Source>
      </Map>

      <button
        type="button"
        onClick={() => setLabelled((on) => !on)}
        aria-pressed={labelled}
        className={cn(
          "border-forest-deep/20 absolute top-3 right-3 rounded-md border px-2.5 py-1.5 text-xs shadow-sm transition-colors",
          labelled
            ? "bg-forest text-sand"
            : "text-forest bg-paper/90 hover:bg-paper",
        )}
      >
        Labels
      </button>

      {hovered && (
        <div
          // Offset off the cursor so the label never sits under the pointer,
          // and thrown to the other side near an edge so it cannot run off the
          // map — which it otherwise would, since the map reaches the window.
          style={{
            left: hovered.x + (hovered.flipX ? -14 : 14),
            top: hovered.y + (hovered.flipY ? -14 : 14),
            transform: `translate(${hovered.flipX ? "-100%" : "0"}, ${
              hovered.flipY ? "-100%" : "0"
            })`,
          }}
          className="border-forest-deep bg-forest text-sand pointer-events-none absolute z-10 max-w-56 rounded-md border px-2 py-1.5 shadow-lg"
        >
          <p className="flex items-baseline gap-2">
            <span className="tabular text-blaze text-xs">{hovered.id}</span>
            <span className="truncate text-xs">
              {hovered.name ?? "unnamed"}
            </span>
          </p>
          <p className="tabular text-sand/50 text-[0.6875rem] whitespace-nowrap">
            {formatMiles(hovered.meters)} · ↑{formatFeet(hovered.gain)}
          </p>
        </div>
      )}
    </div>
  );
}
