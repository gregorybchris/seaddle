import type {
  Difficulty,
  Direction,
  GraphFile,
  LaneQuality,
  Scenic,
  SegmentId,
  SegmentRecord,
  Surface,
} from "@/lib/models/graph";

/**
 * What a review pass can change about a segment.
 *
 * Every field optional, because bulk editing is the normal case: whole trails
 * share a surface without sharing a difficulty, and applying one attribute
 * across forty segments must not overwrite the other five.
 */
export type AttributePatch = {
  difficultyForward?: Difficulty;
  difficultyBackward?: Difficulty;
  laneQuality?: LaneQuality;
  scenic?: Scenic;
  surface?: Surface;
  recommendedDirection?: Direction | null;
};

/**
 * Apply a patch to one or many segments, marking them reviewed.
 *
 * Reviewing is the act of deciding, so any deliberate edit is what flips
 * `reviewed` — there is no separate button to remember to press, and no way to
 * end up with attributes someone chose that still read as untouched defaults.
 */
export function applyAttributes(
  graph: GraphFile,
  ids: SegmentId[],
  patch: AttributePatch,
): GraphFile {
  const targets = new Set(ids);
  if (targets.size === 0) return graph;

  return {
    ...graph,
    segments: graph.segments.map((segment) =>
      targets.has(segment.id) ? patched(segment, patch) : segment,
    ),
  };
}

function patched(segment: SegmentRecord, patch: AttributePatch): SegmentRecord {
  return {
    ...segment,
    difficulty: {
      forward: patch.difficultyForward ?? segment.difficulty.forward,
      backward: patch.difficultyBackward ?? segment.difficulty.backward,
    },
    laneQuality: patch.laneQuality ?? segment.laneQuality,
    scenic: patch.scenic ?? segment.scenic,
    surface: patch.surface ?? segment.surface,
    recommendedDirection:
      patch.recommendedDirection === undefined
        ? segment.recommendedDirection
        : patch.recommendedDirection,
    reviewed: true,
  };
}

/** Put a segment back in the queue, without touching what it says. */
export function markUnreviewed(graph: GraphFile, id: SegmentId): GraphFile {
  return {
    ...graph,
    segments: graph.segments.map((segment) =>
      segment.id === id ? { ...segment, reviewed: false } : segment,
    ),
  };
}

/**
 * The next segment still carrying defaults, wrapping around.
 *
 * Reviewing 145 segments is only bearable if finishing one hands you the next,
 * so this drives a button rather than making someone hunt the list for what
 * they have not done yet.
 */
export function nextUnreviewed(
  segments: SegmentRecord[],
  after: SegmentId | null,
): SegmentId | null {
  const pending = segments.filter((segment) => !segment.reviewed);
  if (pending.length === 0) return null;
  if (after === null) return pending[0].id;

  const later = pending.find((segment) => segment.id > after);
  return (later ?? pending[0]).id;
}

export function reviewProgress(segments: SegmentRecord[]): {
  reviewed: number;
  total: number;
} {
  return {
    reviewed: segments.filter((segment) => segment.reviewed).length,
    total: segments.length,
  };
}

/**
 * Turn a segment around: what was its start becomes its end.
 *
 * Offered instead of a "backward" recommendation, which asks a reader to hold
 * two directions in their head at once — the way the segment is stored and the
 * way it should be ridden. Flipping the segment collapses those into one, so
 * the recommended way is always simply forward.
 *
 * Everything that means "which way" has to turn with it: the junctions, the
 * per-direction difficulty, the pins measured along it, and the source indices
 * — without those last two, `geometry:rebuild` would redraw the old direction
 * and put every pin on the wrong half of the road.
 */
export function swapSegmentDirection(
  graph: GraphFile,
  id: SegmentId,
): GraphFile {
  return {
    ...graph,
    segments: graph.segments.map((segment) =>
      segment.id === id
        ? {
            ...segment,
            from: segment.to,
            to: segment.from,
            source: {
              track: segment.source.track,
              startIndex: segment.source.endIndex,
              endIndex: segment.source.startIndex,
            },
            difficulty: {
              forward: segment.difficulty.backward,
              backward: segment.difficulty.forward,
            },
          }
        : segment,
    ),
    pins: graph.pins.map((pin) =>
      pin.segment === id ? { ...pin, at: 1 - pin.at } : pin,
    ),
  };
}
