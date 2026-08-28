import type { ElevCoord } from "@/lib/models/geo";
import type { GraphFile, SegmentRecord } from "@/lib/models/graph";
import { SEGMENT_DEFAULTS } from "@/lib/models/graph";

export function segment(
  id: string,
  from: string,
  to: string,
  overrides: Partial<SegmentRecord> = {},
): SegmentRecord {
  return {
    ...SEGMENT_DEFAULTS,
    id,
    from,
    to,
    source: { track: "test-track", startIndex: 0, endIndex: 10 },
    ...overrides,
  };
}

export function graph(overrides: Partial<GraphFile> = {}): GraphFile {
  return { version: 1, nodes: [], segments: [], pins: [], ...overrides };
}

/** A short line climbing east, so forward and backward gain differ. */
export function line(elevations: number[] = [0, 10, 20]): ElevCoord[] {
  return elevations.map((ele, i) => [-122.33 + i * 0.001, 47.68, ele]);
}
