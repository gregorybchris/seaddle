import type { Feature, FeatureCollection, LineString } from "geojson";
import { boundsOf } from "@/lib/geo/bounds";
import { buildAdjacency, type Adjacency } from "@/lib/graph/adjacency";
import type { Bounds, ElevCoord } from "@/lib/models/geo";
import type {
  Direction,
  Protection,
  NodeId,
  Surroundings,
  SegmentId,
  Steepness,
} from "@/lib/models/graph";

/**
 * A segment as the site holds it: the compiled feature, unpacked.
 *
 * Everything here came out of `graph:build`, so no measurement happens in the
 * browser — the numbers a rider is shown are the ones the build computed.
 */
export type SiteSegment = {
  id: SegmentId;
  from: NodeId;
  to: NodeId;
  points: ElevCoord[];
  meters: number;
  gainForward: number;
  gainBackward: number;
  steepness: Steepness;
  protection: Protection;
  surroundings: Surroundings;
  recommendedDirection: Direction | null;
};

export type SiteGraph = {
  segments: Map<SegmentId, SiteSegment>;
  adjacency: Adjacency;
  bounds: Bounds;
};

export function parseGraph(collection: FeatureCollection): SiteGraph {
  const segments = new Map<SegmentId, SiteSegment>();
  for (const feature of collection.features) {
    const segment = parseSegment(feature as Feature<LineString>);
    if (segment) segments.set(segment.id, segment);
  }

  const all = [...segments.values()];
  return {
    segments,
    adjacency: buildAdjacency(all),
    bounds:
      all.length > 0
        ? boundsOf(all.flatMap((s) => s.points))
        : { minLon: -122.45, minLat: 47.5, maxLon: -122.2, maxLat: 47.73 },
  };
}

function parseSegment(feature: Feature<LineString>): SiteSegment | null {
  const p = feature.properties;
  if (!p?.id) return null;
  return {
    id: String(p.id),
    from: String(p.from),
    to: String(p.to),
    points: feature.geometry.coordinates as ElevCoord[],
    meters: Number(p.meters ?? 0),
    gainForward: Number(p.gainForward ?? 0),
    gainBackward: Number(p.gainBackward ?? 0),
    steepness: p.steepness as Steepness,
    protection: p.protection as Protection,
    surroundings: p.surroundings as Surroundings,
    recommendedDirection: (p.recommendedDirection as Direction | null) ?? null,
  };
}
