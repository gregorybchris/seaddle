import type { GraphFile, NodeId, SegmentId } from "@/lib/models/graph";

/**
 * Sort every collection by id.
 *
 * The admin autosaves on every keystroke-ish edit, and git is the review step.
 * A file whose 200 segments reorder on each save produces a diff nobody can
 * read, which quietly defeats the whole point of keeping this in the repo.
 */
export function sortGraph(graph: GraphFile): GraphFile {
  const byId = <T extends { id: string }>(a: T, b: T) =>
    a.id.localeCompare(b.id);
  return {
    version: graph.version,
    nodes: [...graph.nodes].sort(byId),
    segments: [...graph.segments].sort(byId),
    pins: [...graph.pins].sort(byId),
  };
}

/**
 * Pretty-printed, but with coordinate pairs kept on one line.
 *
 * Left to itself, JSON.stringify spreads every `[lon, lat]` over six lines, so
 * a file with a few hundred junctions becomes thousands of lines of single
 * numbers. The file exists to be read in a diff; a coordinate is one value.
 */
export function serializeGraph(graph: GraphFile): string {
  const pretty = JSON.stringify(sortGraph(graph), null, 2);
  return (
    pretty.replace(
      /\[\s*\n\s*(-?\d+(?:\.\d+)?),\s*\n\s*(-?\d+(?:\.\d+)?)\s*\n\s*\]/g,
      "[$1, $2]",
    ) + "\n"
  );
}

/**
 * Something worth looking at, and enough to go and look.
 *
 * The ids matter as much as the message: a warning that names a duplicate is
 * only useful if the thing it names can be found, and hunting an id through a
 * list of a hundred and fifty is how a warning gets ignored.
 */
export type GraphProblem = {
  level: "error" | "warning";
  message: string;
  nodes?: NodeId[];
  segments?: SegmentId[];
};

/**
 * Everything that can be checked without looking at the geometry files.
 *
 * Reported rather than thrown, because the admin needs to show a list of
 * problems while you work rather than refusing to load.
 */
export function validateGraph(graph: GraphFile): GraphProblem[] {
  const problems: GraphProblem[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const segmentIds = new Set(graph.segments.map((s) => s.id));
  const referencedNodes = new Set<string>();
  const nodePairs = new Map<string, string[]>();

  for (const segment of graph.segments) {
    for (const end of [segment.from, segment.to]) {
      referencedNodes.add(end);
      if (!nodeIds.has(end)) {
        problems.push({
          level: "error",
          message: `Segment ${segment.id} references missing junction ${end}`,
          segments: [segment.id],
        });
      }
    }
    if (segment.from === segment.to) {
      problems.push({
        level: "warning",
        message: `Segment ${segment.id} starts and ends at ${segment.from}`,
        segments: [segment.id],
        nodes: [segment.from],
      });
    }
    // Direction-independent, so an A→B and a B→A segment count as duplicates.
    const pair = [segment.from, segment.to].sort().join("~");
    nodePairs.set(pair, [...(nodePairs.get(pair) ?? []), segment.id]);
  }

  for (const [pair, ids] of nodePairs) {
    if (ids.length > 1) {
      problems.push({
        level: "warning",
        message: `${ids.length} segments run between ${pair.replace("~", " and ")}`,
        segments: ids,
        nodes: pair.split("~"),
      });
    }
  }

  // Counted rather than listed one per line. Junctions are placed before the
  // segments between them, so during a mapping session most of them are
  // legitimately unused and a warning each would bury everything else.
  const unused = graph.nodes
    .filter((node) => !referencedNodes.has(node.id))
    .map((node) => node.id);
  if (unused.length > 0) {
    problems.push({
      level: "warning",
      message: `${unused.length} junction(s) carry no segment`,
      nodes: unused,
    });
  }

  for (const pin of graph.pins) {
    if (!segmentIds.has(pin.segment)) {
      problems.push({
        level: "error",
        message: `Pin ${pin.id} references missing segment ${pin.segment}`,
      });
    }
    if (pin.at < 0 || pin.at > 1) {
      problems.push({
        level: "error",
        message: `Pin ${pin.id} has an out-of-range position (${pin.at})`,
      });
    }
  }

  const unreviewed = graph.segments.filter((s) => !s.reviewed).length;
  if (unreviewed > 0) {
    problems.push({
      level: "warning",
      message: `${unreviewed} segment(s) still have default attributes`,
      segments: graph.segments.filter((s) => !s.reviewed).map((s) => s.id),
    });
  }

  return problems;
}
