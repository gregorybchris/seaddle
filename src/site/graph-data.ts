import type { Feature, FeatureCollection, LineString } from "geojson";
import { boundsOf } from "@/lib/geo/bounds";
import { buildAdjacency, type Adjacency } from "@/lib/graph/adjacency";
import type { Bounds, Coord, ElevCoord } from "@/lib/models/geo";
import {
  isPinKind,
  type Crossing,
  type PinKind,
  type Protection,
  type NodeId,
  type Surroundings,
  type SegmentId,
  type Steepness,
} from "@/lib/models/graph";

/**
 * A segment as the site holds it: the compiled feature, unpacked.
 *
 * Everything here came out of `graph:build`, so no measurement happens in the
 * browser — the numbers a rider is shown are the ones the build computed.
 */
export type SiteSegment = {
  id: SegmentId;
  name: string | null;
  from: NodeId;
  to: NodeId;
  points: ElevCoord[];
  meters: number;
  gainForward: number;
  gainBackward: number;
  steepness: Steepness;
  protection: Protection;
  surroundings: Surroundings;
  /** Set where the segment is covered rather than ridden — the ferry. */
  crossing: Crossing | null;
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
    name: p.name ? String(p.name) : null,
    meters: Number(p.meters ?? 0),
    gainForward: Number(p.gainForward ?? 0),
    gainBackward: Number(p.gainBackward ?? 0),
    steepness: p.steepness as Steepness,
    protection: p.protection as Protection,
    surroundings: p.surroundings as Surroundings,
    crossing: (p.crossing ?? null) as Crossing | null,
  };
}

/** A point of interest as the site holds it. */
export type SitePin = {
  id: string;
  segment: string;
  kind: PinKind;
  note: string | null;
  at: number;
  coord: Coord;
};

export function parsePins(collection: FeatureCollection): SitePin[] {
  return collection.features.flatMap((feature) => {
    const p = feature.properties;
    const where = feature.geometry;
    if (!p?.id || where.type !== "Point") return [];
    // Dropping one pin the build cannot draw, rather than rendering an icon
    // that does not exist and losing the map with it.
    if (!isPinKind(p.kind)) return [];
    return [
      {
        id: String(p.id),
        segment: String(p.segment),
        kind: p.kind,
        note: p.note ? String(p.note) : null,
        at: Number(p.at ?? 0),
        coord: where.coordinates as Coord,
      },
    ];
  });
}
