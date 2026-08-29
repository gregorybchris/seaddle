import "mapbox-gl/dist/mapbox-gl.css";
import { MAP_STYLE } from "@/lib/map-style";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  AttributionControl,
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl";
import type { Bounds, Coord, ElevCoord } from "@/lib/models/geo";
import type {
  GraphNode,
  Pin,
  SegmentId,
  SegmentRecord,
} from "@/lib/models/graph";
import type { Track } from "@/lib/models/track";
import { cn } from "@/lib/utilities/style-utils";
import { Palette } from "@phosphor-icons/react";
import { useBasemapChoice, useBasemapPaint } from "@/lib/use-basemap";
import { BasemapChoices } from "@/widgets/basemap-choices";
import { Dialog } from "@/widgets/dialog";
import { MapButton } from "@/widgets/map-button";
import { LineEnds } from "@/widgets/line-ends";
import { PinMark } from "@/widgets/pin-mark";
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
  selectedSegmentIds: string[];
  pins: Pin[];
  selectedPinId: string | null;
  /** Somewhere to fly to. A fresh object each time, so asking twice works. */
  focus: { bounds: Bounds; maxZoom?: number } | null;
  onMapClick: (
    coord: Coord,
    segmentId: string | null,
    additive: boolean,
  ) => void;
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
  selectedSegmentIds,
  pins,
  selectedPinId,
  focus,
  onMapClick,
}: AdminMapProps) {
  const mapRef = useRef<MapRef>(null);
  // The admin picks its own ground and keeps it in the same place the site
  // does, so switching between the two does not switch the map out from under
  // you. There is no encoding here to co-locate it with, so the dialog holds
  // the one setting.
  const [basemap, setBasemap] = useBasemapChoice();
  const [themeOpen, setThemeOpen] = useState(false);
  useBasemapPaint(mapRef, basemap);
  const wrap = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [labeled, setLabeled] = useState(false);

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

  /**
   * Where the selected segment starts and finishes.
   *
   * A line on a map has no visible direction, but almost everything stored
   * about a segment does — which way the hill goes, which way to ride it — so
   * one selected segment gets a start and a finish drawn on it. Only ever one:
   * two segments would give two starts and say nothing.
   */
  const ends = (() => {
    if (selectedSegmentIds.length !== 1) return null;
    const points = geometry.get(selectedSegmentIds[0]);
    if (!points || points.length < 2) return null;
    return {
      start: points[0],
      finish: points[points.length - 1],
    };
  })();

  return (
    <div ref={wrap} className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -122.33, latitude: 47.62, zoom: 11 }}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        // Collapsed to a single mark rather than removed. Mapbox's terms and
        // OpenStreetMap's licence both require the credit to be shown, and
        // compact is the smallest form they allow — the earlier codebase turns
        // it off outright, which is not something to copy.
        attributionControl={false}
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
            event.originalEvent.shiftKey || event.originalEvent.metaKey,
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
            filter={["in", ["get", "id"], ["literal", selectedSegmentIds]]}
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
              visibility: labeled ? "visible" : "none",
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
        {pins.map((pin) => (
          <Marker key={pin.id} longitude={pin.coord[0]} latitude={pin.coord[1]}>
            <PinMark kind={pin.kind} selected={pin.id === selectedPinId} />
          </Marker>
        ))}

        {ends && (
          <LineEnds start={ends.start} finish={ends.finish} subject="Segment" />
        )}
        <AttributionControl compact />
      </Map>

      {/* A row below the labels toggle, which already holds the top corner. */}
      <MapButton
        aria-label="Map theme"
        aria-haspopup="dialog"
        onClick={() => setThemeOpen(true)}
        className="absolute top-13 right-3 z-10"
      >
        <Palette size={17} weight="bold" />
      </MapButton>
      <Dialog
        open={themeOpen}
        onOpenChange={setThemeOpen}
        title="Map theme"
        description="Which style the map is drawn in."
      >
        <BasemapChoices value={basemap} onChange={setBasemap} />
      </Dialog>

      <button
        type="button"
        onClick={() => setLabeled((on) => !on)}
        aria-pressed={labeled}
        className={cn(
          "border-forest-deep/20 absolute top-3 right-3 rounded-md border px-2.5 py-1.5 text-xs shadow-sm transition-colors",
          labeled
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
          <p className="tabular text-sand/70 text-[0.6875rem] whitespace-nowrap">
            {formatMiles(hovered.meters)} · ↑{formatFeet(hovered.gain)}
          </p>
        </div>
      )}
    </div>
  );
}
