import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { ElevCoord } from "@/lib/models/geo";
import type { GraphNode, SegmentId } from "@/lib/models/graph";
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
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: tracks.map((track) => ({
      type: "Feature",
      properties: { slug: track.slug },
      geometry: {
        type: "LineString",
        coordinates: track.points as number[][],
      },
    })),
  };
}

export function segmentsToGeoJson(
  geometry: Map<SegmentId, ElevCoord[]>,
): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: [...geometry.entries()].map(([id, points]) => ({
      type: "Feature",
      id,
      properties: { id },
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
