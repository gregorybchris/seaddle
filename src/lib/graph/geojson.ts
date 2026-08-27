import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { ElevCoord } from "@/lib/models/geo";
import type { GraphFile, SegmentId } from "@/lib/models/graph";
import { deriveSegment } from "./derive";

/**
 * The runtime format: one LineString per segment, every attribute flattened
 * into properties.
 *
 * Flat scalar properties are the point. Mapbox styles read them with `["get",
 * ...]`, so recolouring the whole map by a different attribute or dimming
 * everything a filter excludes is a paint expression evaluated on the GPU —
 * not React state and not a re-render.
 */
export function buildGraphGeoJson(
  graph: GraphFile,
  geometry: Map<SegmentId, ElevCoord[]>,
): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = graph.segments.map((segment) => {
    const points = geometry.get(segment.id);
    if (!points) {
      throw new Error(`Segment ${segment.id} has no geometry file`);
    }
    const derived = deriveSegment(points);
    return {
      type: "Feature" as const,
      id: segment.id,
      properties: {
        id: segment.id,
        from: segment.from,
        to: segment.to,
        difficultyForward: segment.difficulty.forward,
        difficultyBackward: segment.difficulty.backward,
        laneQuality: segment.laneQuality,
        scenic: segment.scenic,
        surface: segment.surface,
        recommendedDirection: segment.recommendedDirection,
        reviewed: segment.reviewed,
        ...derived,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: points as number[][],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

export function buildPinsGeoJson(graph: GraphFile): FeatureCollection<Point> {
  const segmentIds = new Set(graph.segments.map((s) => s.id));
  const features: Feature<Point>[] = graph.pins.map((pin) => {
    if (!segmentIds.has(pin.segment)) {
      throw new Error(
        `Pin ${pin.id} references missing segment ${pin.segment}`,
      );
    }
    return {
      type: "Feature" as const,
      id: pin.id,
      properties: {
        id: pin.id,
        segment: pin.segment,
        kind: pin.kind,
        note: pin.note,
        at: pin.at,
      },
      geometry: { type: "Point" as const, coordinates: pin.coord as number[] },
    };
  });

  return { type: "FeatureCollection", features };
}
