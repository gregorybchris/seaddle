import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from "geojson";
import { splitAtGaps } from "@/lib/gpx/recording-gaps";
import type { ElevCoord } from "@/lib/models/geo";
import { deriveSegment } from "@/lib/graph/derive";
import type { GraphNode, SegmentId, SegmentRecord } from "@/lib/models/graph";
import type { Track } from "@/lib/models/track";

export function lineFeature(points: ElevCoord[]): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points as number[][] },
  };
}

export const EMPTY_LINES: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Every source ride as one collection.
 *
 * Drawn as separate translucent features rather than merged, so that where two
 * rides cover the same road the strokes stack and the road gets brighter. That
 * accumulation is the heatmap — it shows which roads are actually ridden, which
 * is where junctions want to go.
 */
export function tracksToGeoJson(
  tracks: Track[],
): FeatureCollection<MultiLineString> {
  return {
    type: "FeatureCollection",
    features: tracks.map((track) => ({
      type: "Feature",
      properties: { slug: track.slug },
      geometry: {
        type: "MultiLineString",
        // Drawn as the stretches that were actually recorded, so the straight
        // line a GPS leaves behind on a ferry is not painted across the water
        // as though it were a road.
        coordinates: splitAtGaps(
          track.points,
          track.gaps ?? [],
        ) as number[][][],
      },
    })),
  };
}

/**
 * Mapped segments, carrying enough about themselves to be identified in place.
 *
 * Name and length ride along in the properties so the map can answer "what is
 * this line?" without the sidebar being involved, and so a label layer can read
 * them straight off the feature.
 */
export function segmentsToGeoJson(
  segments: SegmentRecord[],
  geometry: Map<SegmentId, ElevCoord[]>,
): FeatureCollection<LineString> {
  const names = new Map(segments.map((segment) => [segment.id, segment.name]));
  return {
    type: "FeatureCollection",
    features: [...geometry.entries()].map(([id, points]) => ({
      type: "Feature",
      id,
      properties: {
        id,
        name: names.get(id) ?? null,
        ...deriveSegment(points),
      },
      geometry: { type: "LineString", coordinates: points as number[][] },
    })),
  };
}

export function nodesToGeoJson(
  nodes: GraphNode[],
  selected: string[],
): FeatureCollection<Point> {
  const chosen = new Set(selected);
  return {
    type: "FeatureCollection",
    features: nodes.map((node) => ({
      type: "Feature",
      id: node.id,
      properties: { id: node.id, selected: chosen.has(node.id) },
      geometry: { type: "Point", coordinates: node.coord as number[] },
    })),
  };
}
