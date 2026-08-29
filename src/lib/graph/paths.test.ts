import { describe, expect, it } from "vitest";
import { buildAdjacency } from "./adjacency";
import { pathTo, reachFrom, type Weighted } from "./paths";

function edges(...rows: [string, string, string, number][]): Weighted[] {
  return rows.map(([id, from, to, meters]) => ({ id, from, to, meters }));
}

function search(segments: Weighted[], sources: string[]) {
  return reachFrom(
    buildAdjacency(segments),
    new Map(segments.map((segment) => [segment.id, segment])),
    sources,
  );
}

describe("reachFrom", () => {
  it("measures a chain in metres, not in segments", () => {
    const reach = search(
      edges(["s1", "nA", "nB", 300], ["s2", "nB", "nC", 700]),
      ["nA"],
    );
    expect(reach.metersTo.get("nA")).toBe(0);
    expect(reach.metersTo.get("nC")).toBe(1000);
  });

  it("takes the shorter way round even where it is more segments", () => {
    // One long segment against three short ones between the same two nodes.
    const reach = search(
      edges(
        ["s1", "nA", "nZ", 5000],
        ["s2", "nA", "nB", 100],
        ["s3", "nB", "nC", 100],
        ["s4", "nC", "nZ", 100],
      ),
      ["nA"],
    );
    expect(reach.metersTo.get("nZ")).toBe(300);
    expect(pathTo(reach, "nZ").map((leg) => leg.segment)).toEqual([
      "s2",
      "s3",
      "s4",
    ]);
  });

  it("counts from whichever source is nearer", () => {
    const reach = search(
      edges(["s1", "nA", "nB", 900], ["s2", "nB", "nC", 100]),
      ["nA", "nC"],
    );
    expect(reach.metersTo.get("nB")).toBe(100);
    expect(pathTo(reach, "nB").map((leg) => leg.from)).toEqual(["nC"]);
  });

  it("leaves out what no source can reach", () => {
    const reach = search(
      edges(["s1", "nA", "nB", 100], ["s2", "nY", "nZ", 100]),
      ["nA"],
    );
    expect(reach.metersTo.has("nB")).toBe(true);
    expect(reach.metersTo.has("nZ")).toBe(false);
    expect(pathTo(reach, "nZ")).toEqual([]);
  });

  it("orients each leg the way it is ridden", () => {
    // s2 is stored nC→nB, so riding out from nA takes it backwards.
    const reach = search(
      edges(["s1", "nA", "nB", 100], ["s2", "nC", "nB", 100]),
      ["nA"],
    );
    expect(pathTo(reach, "nC")).toEqual([
      { segment: "s1", from: "nA", to: "nB" },
      { segment: "s2", from: "nB", to: "nC" },
    ]);
  });

  it("settles a dead heat the same way every time", () => {
    // Two ways round a block of identical length. A link replays through this
    // search, so the answer has to be the same one on every run.
    const both = edges(
      ["s1", "nA", "nB", 500],
      ["s2", "nB", "nZ", 500],
      ["s3", "nA", "nC", 500],
      ["s4", "nC", "nZ", 500],
    );
    const first = pathTo(search(both, ["nA"]), "nZ");
    const second = pathTo(search([...both].reverse(), ["nA"]), "nZ");
    expect(first.map((leg) => leg.segment)).toEqual(
      second.map((leg) => leg.segment),
    );
  });

  it("has no journey to the source itself", () => {
    const reach = search(edges(["s1", "nA", "nB", 100]), ["nA"]);
    expect(pathTo(reach, "nA")).toEqual([]);
  });

  it("is empty for a graph with no segments", () => {
    const reach = search([], ["nA"]);
    expect([...reach.metersTo.keys()]).toEqual(["nA"]);
  });
});
