import { describe, expect, it } from "vitest";
import { haversineMeters } from "@/lib/geo/distance";
import { polylineMeters } from "@/lib/geo/polyline";
import { graph as emptyGraph } from "@/lib/graph/test-fixtures";
import type { GraphNode } from "@/lib/models/graph";
import { buildTrackIndex, findCandidates } from "./candidate-finder";
import {
  addSegment,
  extractGeometry,
  placeNode,
  removeSegment,
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
      expect(Math.round(value * 1e5) / 1e5).toBe(value);
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
      expect(Math.round(lon * 1e5) / 1e5).toBe(lon);
      expect(Math.round(lat * 1e5) / 1e5).toBe(lat);
    }
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
    expect(segment.surface).toBe("asphalt");
    expect(segment.difficulty).toEqual({
      forward: "medium",
      backward: "medium",
    });
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

  it("takes its unnamed junctions with it", () => {
    const { graph } = addSegment(
      emptyGraph({ nodes: [nodeA, nodeB] }),
      candidate,
      nodeA,
      nodeB,
    );
    const after = removeSegment(graph, "s001");
    expect(after.segments).toEqual([]);
    expect(after.nodes).toEqual([]);
  });

  it("keeps a junction that is still holding another segment up", () => {
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
    expect(after.nodes.map((n) => n.id).sort()).toEqual(["n002", "n003"]);
  });

  it("keeps a named junction, which was deliberate", () => {
    const named = { id: "n001", name: "Fremont Bridge", coord: A };
    const { graph } = addSegment(
      emptyGraph({ nodes: [named, nodeB] }),
      candidate,
      named,
      nodeB,
    );
    expect(removeSegment(graph, "s001").nodes.map((n) => n.id)).toEqual([
      "n001",
    ]);
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
          kind: "water" as const,
          note: null,
          at: 0.5,
          coord: A,
        },
      ],
    };
    expect(removeSegment(withPin, "s001").pins).toEqual([]);
  });
});
