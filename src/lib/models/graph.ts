import type { Coord } from "./geo";

export type NodeId = string; // "n017"
export type SegmentId = string; // "s042"
export type PinId = string; // "p003"

export type Steepness = "flat" | "rolling" | "steep";
export type Protection = "unprotected" | "bikeLane" | "bikePath";
export type Surroundings = "plain" | "pleasant" | "beautiful";

export const STEEPNESSES: Steepness[] = ["flat", "rolling", "steep"];
export const PROTECTIONS: Protection[] = [
  "unprotected",
  "bikeLane",
  "bikePath",
];
export const SURROUNDINGS: Surroundings[] = ["plain", "pleasant", "beautiful"];

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
  /**
   * What this stretch of road is called, shown to riders where one is set.
   *
   * Started as an admin-only audit label and earned its way out: "Ballard
   * Locks to Golden Gardens" tells someone deciding far more than any
   * attribute can. Still optional — an unnamed segment is described by its
   * numbers alone rather than by an id nobody outside the editor can use.
   */
  name: string | null;
  from: NodeId;
  to: NodeId;

  /** Which source track this geometry was cropped from, and where. */
  source: { track: string; startIndex: number; endIndex: number };

  /** How much climbing it involves, ridden either way. */
  steepness: Steepness;
  protection: Protection;
  surroundings: Surroundings;

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

/**
 * What a pin can be.
 *
 * All but the last are amenities — reasons to stop. `hazard` is the opposite: a
 * reason to slow down, for a pothole, a bad seam, a crossing that has to be
 * taken carefully. It shares the pin machinery because it is the same kind of
 * fact about the same kind of place, and it is drawn differently because
 * reading it as somewhere to stop for water would be worse than not seeing it.
 */
export type PinKind =
  | "drinkingWater"
  | "restroom"
  | "viewpoint"
  | "restStop"
  | "bikeShop"
  | "hazard";

export const PIN_KINDS: PinKind[] = [
  "drinkingWater",
  "restroom",
  "viewpoint",
  "restStop",
  "bikeShop",
  "hazard",
];

/** What each kind is called where a rider reads it. */
export const PIN_LABELS: Record<PinKind, string> = {
  drinkingWater: "drinking water",
  restroom: "restroom",
  viewpoint: "viewpoint",
  restStop: "rest stop",
  bikeShop: "bike shop",
  hazard: "hazard",
};

/**
 * Whether a value off the wire is a kind this build knows.
 *
 * `pins.geojson` is fetched at runtime and cached on its own terms, so it can
 * be newer than the bundle reading it — a browser holding yesterday's code can
 * be handed today's pins. An unknown kind has no icon and no label, and drawing
 * one would take the map down over a pothole.
 */
export function isPinKind(value: unknown): value is PinKind {
  return typeof value === "string" && (PIN_KINDS as string[]).includes(value);
}

/** The kinds that warn rather than offer. Drawn to be read as a caution. */
export const PIN_WARNINGS: ReadonlySet<PinKind> = new Set<PinKind>(["hazard"]);

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
 * What a segment looks like the moment it is extracted, before anyone has
 * judged it.
 *
 * Extraction should be cheap and fast; deciding whether a segment is pleasant
 * is a separate pass. `reviewed` is what keeps "asphalt because I checked"
 * distinct from "asphalt because nobody has looked at this yet".
 */
export const SEGMENT_DEFAULTS = {
  name: null,
  steepness: "flat",
  protection: "unprotected",
  surroundings: "plain",
  reviewed: false,
} satisfies Omit<SegmentRecord, "id" | "from" | "to" | "source">;

export const EMPTY_GRAPH: GraphFile = {
  version: 1,
  nodes: [],
  segments: [],
  pins: [],
};
