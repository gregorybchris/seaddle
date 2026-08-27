import type { Coord } from "./geo";

export type NodeId = string; // "n017"
export type SegmentId = string; // "s042"
export type PinId = string; // "p003"

export type Steepness = "flat" | "hilly" | "steep";
export type Protection = "unprotected" | "roadBikeLane" | "fullBikePath";
export type Surroundings = "plain" | "nice" | "scenic";
export type Surface = "asphalt" | "gravel" | "dirt";
export type Direction = "forward" | "backward";

export const STEEPNESSES: Steepness[] = ["flat", "hilly", "steep"];
export const PROTECTIONS: Protection[] = [
  "unprotected",
  "roadBikeLane",
  "fullBikePath",
];
export const SURROUNDINGS: Surroundings[] = ["plain", "nice", "scenic"];
export const SURFACES: Surface[] = ["asphalt", "gravel", "dirt"];

export type GraphNode = {
  id: NodeId;
  /** Admin-only audit label. Never shown to users. */
  name: string | null;
  coord: Coord;
};

/**
 * A segment exactly as it is authored on disk.
 *
 * Nothing here can be computed from something else. Length and elevation gain
 * are deliberately absent: they are a function of the geometry, and a copy
 * living in the same file as the thing it is derived from is a copy that goes
 * stale the first time a segment is re-cropped.
 */
export type SegmentRecord = {
  id: SegmentId;
  /** Admin-only audit label. Never shown to users. */
  name: string | null;
  from: NodeId;
  to: NodeId;

  /** Which source track this geometry was cropped from, and where. */
  source: { track: string; startIndex: number; endIndex: number };

  /** How much climbing it involves, ridden either way. */
  steepness: Steepness;
  protection: Protection;
  surroundings: Surroundings;
  surface: Surface;
  recommendedDirection: Direction | null;

  /** False until the attributes above are deliberately set rather than defaulted. */
  reviewed: boolean;
};

/** Everything `graph:build` works out from a segment's points. */
export type SegmentDerived = {
  meters: number;
  gainForward: number;
  gainBackward: number;
};

/** A segment as the app sees it: authored fields plus computed ones. */
export type Segment = SegmentRecord & SegmentDerived;

export type PinKind = "water" | "restroom" | "photo" | "rest" | "bike-shop";

export const PIN_KINDS: PinKind[] = [
  "water",
  "restroom",
  "photo",
  "rest",
  "bike-shop",
];

/** What each kind is called where a rider reads it. */
export const PIN_LABELS: Record<PinKind, string> = {
  water: "water",
  restroom: "restroom",
  photo: "photo op",
  rest: "rest stop",
  "bike-shop": "bike shop",
};

export type Pin = {
  id: PinId;
  segment: SegmentId;
  kind: PinKind;
  note: string | null;
  /** 0..1 along the segment, from → to. Orders pins along an assembled route. */
  at: number;
  /** Where the pin actually is, which may sit slightly off the line. */
  coord: Coord;
};

/** The on-disk shape of src/db/graph.json. Arrays are sorted by id for stable diffs. */
export type GraphFile = {
  version: 1;
  nodes: GraphNode[];
  segments: SegmentRecord[];
  pins: Pin[];
};

/**
 * What a segment looks like the moment it is extracted, before anyone has judged it.
 *
 * Extraction should be cheap and fast; deciding whether a road is pleasant is a
 * separate pass. `reviewed` is what keeps "asphalt because I checked" distinct
 * from "asphalt because nobody has looked at this yet".
 */
export const SEGMENT_DEFAULTS = {
  name: null,
  steepness: "flat",
  protection: "unprotected",
  surroundings: "plain",
  surface: "asphalt",
  recommendedDirection: null,
  reviewed: false,
} satisfies Omit<SegmentRecord, "id" | "from" | "to" | "source">;

export const EMPTY_GRAPH: GraphFile = {
  version: 1,
  nodes: [],
  segments: [],
  pins: [],
};
