import { describe, expect, it } from "vitest";
import { haversineMeters } from "@/lib/geo/distance";
import { polylineMeters } from "@/lib/geo/polyline";
import { graph as emptyGraph } from "@/lib/graph/test-fixtures";
import type { GraphNode } from "@/lib/models/graph";
import { buildTrackIndex, findCandidates } from "./candidate-finder";
import { projectOntoPolyline, snapEnds } from "@/lib/geo/polyline";
import type { ElevCoord } from "@/lib/models/geo";
import {
  addSegment,
  buildGeometry,
  extractGeometry,
  mergeNodes,
  placeNode,
  removeNode,
  removeSegment,
  renameNode,
  renameSegment,
  snapToNodes,
  snapToTracks,
} from "./extraction";
import { at, trackThrough } from "./test-tracks";

const A = at(0, 0);
const B = at(500, 0);
const TRACK = trackThrough("direct", [at(-100, 0), at(600, 0)]);
const INDEX = buildTrackIndex([TRACK]);

function node(id: string, coord: [number, number]): GraphNode {
  return { id, name: null, coord };
}

describe("snapToNodes", () => {
  const nodes = [node("n001", A), node("n002", B)];

  it("reuses a junction you clicked near", () => {
    expect(snapToNodes(nodes, at(6, 6))?.id).toBe("n001");
  });

  it("ignores one that is too far to have been meant", () => {
    expect(snapToNodes(nodes, at(80, 0))).toBeNull();
  });

  it("takes the closest when two are in range", () => {
    const crowded = [node("n001", at(0, 0)), node("n002", at(12, 0))];
    expect(snapToNodes(crowded, at(10, 0))?.id).toBe("n002");
  });
});

describe("snapToTracks", () => {
  it("pulls a click onto the nearest recorded point", () => {
    const snapped = snapToTracks(INDEX, [TRACK], at(250, 8));
    expect(snapped).not.toBeNull();
    expect(haversineMeters(snapped!.coord, at(250, 0))).toBeLessThan(15);
  });

  it("gives up when nothing is near enough", () => {
    expect(snapToTracks(INDEX, [TRACK], at(250, 400))).toBeNull();
  });
});

describe("placeNode", () => {
  it("creates a junction on the track under the click", () => {
    const placed = placeNode(emptyGraph(), INDEX, [TRACK], at(250, 9));
    expect(placed.reused).toBe(false);
    expect(placed.onTrack).toBe(true);
    expect(placed.graph.nodes).toHaveLength(1);
    expect(haversineMeters(placed.node.coord, at(250, 0))).toBeLessThan(15);
  });

  it("reuses the junction when you click the same intersection twice", () => {
    // The whole reason the graph connects: two clicks at one crossing have to
    // produce one node, or the segments either side never meet.
    const first = placeNode(emptyGraph(), INDEX, [TRACK], at(250, 0));
    const second = placeNode(first.graph, INDEX, [TRACK], at(256, 4));
    expect(second.reused).toBe(true);
    expect(second.node.id).toBe(first.node.id);
    expect(second.graph.nodes).toHaveLength(1);
  });

  it("numbers junctions in sequence", () => {
    const first = placeNode(emptyGraph(), INDEX, [TRACK], at(0, 0));
    const second = placeNode(first.graph, INDEX, [TRACK], at(500, 0));
    expect([first.node.id, second.node.id]).toEqual(["n001", "n002"]);
  });

  it("still places a junction off-track, but says so", () => {
    const placed = placeNode(emptyGraph(), INDEX, [TRACK], at(0, 900));
    expect(placed.onTrack).toBe(false);
    expect(placed.graph.nodes).toHaveLength(1);
  });

  it("rounds the coordinate to the precision segments are stored at", () => {
    const placed = placeNode(emptyGraph(), INDEX, [TRACK], at(250, 0));
    for (const value of placed.node.coord) {
      expect(Math.round(value * 1e6) / 1e6).toBe(value);
    }
  });
});

describe("extractGeometry", () => {
  const candidate = findCandidates([TRACK], INDEX, A, B)[0];
  const nodeA = node("n001", A);
  const nodeB = node("n002", B);

  it("lands the endpoints exactly on the junctions", () => {
    const geometry = extractGeometry(candidate, nodeA.coord, nodeB.coord);
    expect(geometry[0][0]).toBe(A[0]);
    expect(geometry[0][1]).toBe(A[1]);
    expect(geometry[geometry.length - 1][0]).toBe(B[0]);
    expect(geometry[geometry.length - 1][1]).toBe(B[1]);
  });

  it("thins the geometry without changing where it goes", () => {
    const geometry = extractGeometry(candidate, nodeA.coord, nodeB.coord);
    expect(geometry.length).toBeLessThan(candidate.points.length);
    expect(Math.abs(polylineMeters(geometry) - candidate.meters)).toBeLessThan(
      candidate.meters * 0.02,
    );
  });

  it("rounds every coordinate it keeps", () => {
    const geometry = extractGeometry(candidate, nodeA.coord, nodeB.coord);
    for (const [lon, lat] of geometry.slice(1, -1)) {
      expect(Math.round(lon * 1e6) / 1e6).toBe(lon);
      expect(Math.round(lat * 1e6) / 1e6).toBe(lat);
    }
  });
});

describe("buildGeometry", () => {
  // A smooth curve rather than a path of straight legs: a polyline with exact
  // corners simplifies to the same four vertices at any tolerance, which would
  // make the tolerance look like it does nothing. Runs from A to B.
  const BENDY: ElevCoord[] = Array.from({ length: 60 }, (_, i) => {
    const t = i / 59;
    const [lon, lat] = at(t * 500, Math.sin(Math.PI * t) * 60);
    return [lon, lat, 10];
  });

  /** The furthest the drawn line strays from the recorded one. */
  function worstError(truth: ElevCoord[], drawn: ElevCoord[]): number {
    return Math.max(
      ...truth.map(
        (point) =>
          projectOntoPolyline(drawn, [point[0], point[1]]).distanceMeters,
      ),
    );
  }

  it("stays within the tolerance of the recorded line", () => {
    const geometry = buildGeometry(BENDY, A, B, 1);
    expect(worstError(snapEnds(BENDY, A, B), geometry)).toBeLessThan(1.5);
  });

  it("stays within tolerance even when a junction sits well off the ride", () => {
    // The case that made real segments miss by twelve meters: a junction can be
    // twenty meters from where the chosen ride passes, and a simplifier that
    // has not been told the line starts there runs a straight chord out to its
    // first kept point and leaves the road entirely.
    const offset = at(0, 20);
    const geometry = buildGeometry(BENDY, offset, B, 1);
    expect(worstError(snapEnds(BENDY, offset, B), geometry)).toBeLessThan(1.5);
  });

  it("still lands exactly on both junctions", () => {
    const offset = at(0, 20);
    const geometry = buildGeometry(BENDY, offset, B, 1);
    const last = geometry[geometry.length - 1];
    expect([geometry[0][0], geometry[0][1]]).toEqual([offset[0], offset[1]]);
    expect([last[0], last[1]]).toEqual([B[0], B[1]]);
  });

  it("keeps more detail at a tighter tolerance", () => {
    expect(buildGeometry(BENDY, A, B, 1).length).toBeGreaterThan(
      buildGeometry(BENDY, A, B, 10).length,
    );
  });
});

describe("addSegment", () => {
  const candidate = findCandidates([TRACK], INDEX, A, B)[0];
  const nodeA = node("n001", A);
  const nodeB = node("n002", B);
  const base = emptyGraph({ nodes: [nodeA, nodeB] });

  it("stores where the geometry came from", () => {
    const { segment } = addSegment(base, candidate, nodeA, nodeB);
    expect(segment.source.track).toBe("direct");
    expect(segment.source.startIndex).toBe(candidate.startIndex);
  });

  it("arrives defaulted and unreviewed", () => {
    // Extraction is meant to be cheap; judging the road is a separate pass.
    const { segment } = addSegment(base, candidate, nodeA, nodeB);
    expect(segment.reviewed).toBe(false);
    expect(segment.steepness).toBe("flat");
  });

  it("numbers segments in sequence and leaves the input alone", () => {
    const first = addSegment(base, candidate, nodeA, nodeB);
    const second = addSegment(first.graph, candidate, nodeA, nodeB);
    expect([first.segment.id, second.segment.id]).toEqual(["s001", "s002"]);
    expect(base.segments).toHaveLength(0);
  });
});

describe("removeSegment", () => {
  const candidate = findCandidates([TRACK], INDEX, A, B)[0];
  const nodeA = node("n001", A);
  const nodeB = node("n002", B);

  it("leaves the junctions where they are", () => {
    // Deleting a segment is usually the first half of re-cutting it with
    // better geometry, so its junctions are exactly what the next step needs.
    const { graph } = addSegment(
      emptyGraph({ nodes: [nodeA, nodeB] }),
      candidate,
      nodeA,
      nodeB,
    );
    const after = removeSegment(graph, "s001");
    expect(after.segments).toEqual([]);
    expect(after.nodes.map((n) => n.id)).toEqual(["n001", "n002"]);
  });

  it("leaves the other segments alone", () => {
    const first = addSegment(
      emptyGraph({ nodes: [nodeA, nodeB, node("n003", at(1000, 0))] }),
      candidate,
      nodeA,
      nodeB,
    );
    const second = addSegment(first.graph, candidate, nodeB, {
      id: "n003",
      name: null,
      coord: at(1000, 0),
    });
    const after = removeSegment(second.graph, "s001");
    expect(after.segments.map((s) => s.id)).toEqual(["s002"]);
    expect(after.nodes).toHaveLength(3);
  });

  it("drops the pins that lived on it", () => {
    const { graph } = addSegment(
      emptyGraph({ nodes: [nodeA, nodeB] }),
      candidate,
      nodeA,
      nodeB,
    );
    const withPin = {
      ...graph,
      pins: [
        {
          id: "p001",
          segment: "s001",
          kind: "drinkingWater" as const,
          note: null,
          at: 0.5,
          coord: A,
        },
      ],
    };
    expect(removeSegment(withPin, "s001").pins).toEqual([]);
  });
});

describe("renaming", () => {
  const withSegment = addSegment(
    emptyGraph({ nodes: [node("n001", A), node("n002", B)] }),
    findCandidates([TRACK], INDEX, A, B)[0],
    node("n001", A),
    node("n002", B),
  ).graph;

  it("labels a segment", () => {
    expect(
      renameSegment(withSegment, "s001", "Burke-Gilman").segments[0].name,
    ).toBe("Burke-Gilman");
  });

  it("collapses a blank name to null, so absent has one representation", () => {
    const graph = emptyGraph({ nodes: [node("n001", A)] });
    expect(renameNode(graph, "n001", "   ").nodes[0].name).toBeNull();
  });

  it("trims surrounding space", () => {
    const graph = emptyGraph({ nodes: [node("n001", A)] });
    expect(renameNode(graph, "n001", "  Gas Works  ").nodes[0].name).toBe(
      "Gas Works",
    );
  });

  it("leaves everything else alone", () => {
    const graph = emptyGraph({ nodes: [node("n001", A), node("n002", B)] });
    const renamed = renameNode(graph, "n001", "Fremont");
    expect(renamed.nodes[1]).toBe(graph.nodes[1]);
    expect(graph.nodes[0].name).toBeNull();
  });
});

describe("removeNode", () => {
  it("removes a junction nothing is attached to", () => {
    const graph = emptyGraph({ nodes: [node("n001", A), node("n002", B)] });
    const removal = removeNode(graph, "n001");
    expect(removal.blockedBy).toEqual([]);
    expect(removal.graph.nodes.map((n) => n.id)).toEqual(["n002"]);
  });

  it("refuses while a segment is still hanging off it", () => {
    // Cascading would leave geometry pointing at nothing, and taking the
    // segments too would destroy more than the click asked for.
    const nodeA = node("n001", A);
    const nodeB = node("n002", B);
    const { graph } = addSegment(
      emptyGraph({ nodes: [nodeA, nodeB] }),
      findCandidates([TRACK], INDEX, A, B)[0],
      nodeA,
      nodeB,
    );
    const removal = removeNode(graph, "n001");
    expect(removal.blockedBy).toEqual(["s001"]);
    expect(removal.graph.nodes).toHaveLength(2);
  });

  it("does nothing for a junction that is not there", () => {
    const graph = emptyGraph({ nodes: [node("n001", A)] });
    expect(removeNode(graph, "n404").graph.nodes).toHaveLength(1);
  });
});

describe("mergeNodes", () => {
  const candidate = findCandidates([TRACK], INDEX, A, B)[0];
  const nodeA = node("n001", A);
  const nodeB = node("n002", B);
  const stray = node("n003", at(505, 3));

  /** Two segments meeting at a crossing auto-snapping was too tight to see. */
  function twoSided() {
    const first = addSegment(
      emptyGraph({ nodes: [nodeA, nodeB, stray] }),
      candidate,
      nodeA,
      nodeB,
    );
    return addSegment(first.graph, candidate, stray, nodeA).graph;
  }

  it("moves everything hanging off the dropped junction", () => {
    const { graph, moved } = mergeNodes(twoSided(), "n002", "n003");
    expect(moved).toEqual(["s002"]);
    expect(graph.segments[1].from).toBe("n002");
  });

  it("takes the dropped junction with it", () => {
    const { graph } = mergeNodes(twoSided(), "n002", "n003");
    expect(graph.nodes.map((node) => node.id)).toEqual(["n001", "n002"]);
  });

  it("names what moved, since their geometry has to be re-pinned", () => {
    // Without that they would still end where the old junction was and draw a
    // gap at the very crossing this was meant to close.
    const { moved } = mergeNodes(twoSided(), "n001", "n002");
    expect(moved.sort()).toEqual(["s001"]);
  });

  it("refuses to merge a junction into itself", () => {
    const before = twoSided();
    expect(mergeNodes(before, "n001", "n001")).toEqual({
      graph: before,
      moved: [],
    });
  });

  it("leaves the input alone", () => {
    const before = twoSided();
    mergeNodes(before, "n002", "n003");
    expect(before.nodes).toHaveLength(3);
  });
});
