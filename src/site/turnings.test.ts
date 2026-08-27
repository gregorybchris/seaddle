import { describe, expect, it } from "vitest";
import { buildAdjacency } from "@/lib/graph/adjacency";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { SiteGraph, SiteSegment } from "./graph-data";
import { append, startRoute, EMPTY_ROUTE } from "./route";
import { NEARBY, turnings } from "./turnings";

const HUB: Coord = [-122.34, 47.65];
const LAT = 111_320;
const LON = 75_000;

function at(north: number, east: number, ele = 0): ElevCoord {
  return [HUB[0] + east / LON, HUB[1] + north / LAT, ele];
}

function road(
  id: string,
  from: string,
  to: string,
  points: ElevCoord[],
): SiteSegment {
  const climb = points[points.length - 1][2] - points[0][2];
  return {
    id,
    name: null,
    from,
    to,
    points,
    meters: 200,
    gainForward: Math.max(0, climb),
    gainBackward: Math.max(0, -climb),
    steepness: "flat",
    protection: "unprotected",
    surroundings: "plain",
  };
}

/**
 * A crossroads at nB, with a road leaving in each direction.
 *
 * The west road is stored running towards the hub rather than away from it, so
 * that reading it from nB means reading its points backwards — which is the
 * case a version that trusted `from` would get exactly wrong.
 */
function graph(): SiteGraph {
  const all = [
    road("sIn", "nS", "nB", [at(-200, 0), at(-100, 0), at(0, 0)]),
    road("sNorth", "nB", "nN", [at(0, 0), at(100, 0, 30), at(200, 0, 60)]),
    road("sEast", "nB", "nE", [at(0, 0), at(0, 100), at(0, 200)]),
    road("sWest", "nW", "nB", [at(0, -200, 40), at(0, -100, 20), at(0, 0)]),
  ];
  return {
    segments: new Map(all.map((s) => [s.id, s])),
    adjacency: buildAdjacency(all),
    bounds: { minLon: -122.35, minLat: 47.64, maxLon: -122.33, maxLat: 47.66 },
  };
}

const G = graph();
const seg = (id: string) => G.segments.get(id)!;
const headings = (list: ReturnType<typeof turnings>) =>
  list.map((t) => `${t.segment.id}:${t.heading}`);

describe("reading a junction", () => {
  // Arrive at nB from the south, so the three other arms are the choice.
  const arrived = append(startRoute(seg("sIn")), seg("sNorth"), G);

  it("names the way each road sets off from where the rider is", () => {
    // Back at nB after riding north then turning round is not a case here:
    // this is the fork itself, read from the junction it fans out of.
    const list = turnings(startRoute(seg("sIn")), G, null);
    expect(headings(list)).toContain("sNorth:north");
    expect(headings(list)).toContain("sEast:east");
    // Stored nW → nB, so leaving nB on it means running its points backwards.
    expect(headings(list)).toContain("sWest:west");
  });

  it("reads the junction clockwise from north", () => {
    const list = turnings(startRoute(seg("sIn")), G, null);
    expect(list.map((t) => t.heading)).toEqual(["north", "east", "west"]);
  });

  it("does not offer the road just ridden", () => {
    expect(
      turnings(startRoute(seg("sIn")), G, null).map((t) => t.segment.id),
    ).not.toContain("sIn");
  });

  it("reports the climb in the direction it would be ridden", () => {
    // sWest falls 40 m running nW to nB, which is how it is stored — so
    // leaving nB along it is that same 40 m the other way up, and reading
    // `gainForward` because the stored direction says so would call a climb
    // out of the junction flat.
    const west = turnings(startRoute(seg("sIn")), G, null).find(
      (t) => t.segment.id === "sWest",
    )!;
    expect(west.segment.gainForward).toBe(0);
    expect(west.climbMeters).toBe(40);

    const north = turnings(startRoute(seg("sIn")), G, null).find(
      (t) => t.segment.id === "sNorth",
    )!;
    expect(north.climbMeters).toBe(60);
  });

  it("offers only the live end once direction is settled", () => {
    // Two segments in, the far end of the chain is the one place to grow from,
    // so the roads off the start are no longer on offer.
    expect(arrived.ambiguous).toBe(false);
    expect(turnings(arrived, G, null)).toEqual([]);
  });
});

describe("before a ride has started", () => {
  it("offers the roads nearest where the map is looking", () => {
    const nearWest: Coord = [HUB[0] - 190 / LON, HUB[1]];
    expect(turnings(EMPTY_ROUTE, G, nearWest)[0].segment.id).toBe("sWest");

    const nearNorth: Coord = [HUB[0], HUB[1] + 190 / LAT];
    expect(turnings(EMPTY_ROUTE, G, nearNorth)[0].segment.id).toBe("sNorth");
  });

  it("has no direction to report yet", () => {
    const list = turnings(EMPTY_ROUTE, G, HUB);
    expect(list.every((t) => t.heading === null)).toBe(true);
  });

  it("reports the harder of the two climbs while undecided", () => {
    const west = turnings(EMPTY_ROUTE, G, HUB).find(
      (t) => t.segment.id === "sWest",
    )!;
    expect(west.climbMeters).toBe(40);
  });

  it("stays a list rather than becoming the map again", () => {
    const many = graph();
    for (let i = 0; i < 40; i++) {
      const id = `x${i}`;
      many.segments.set(
        id,
        road(id, `p${i}`, `q${i}`, [at(i, 0), at(i, 100), at(i, 200)]),
      );
    }
    many.adjacency = buildAdjacency([...many.segments.values()]);
    expect(turnings(EMPTY_ROUTE, many, HUB)).toHaveLength(NEARBY);
  });

  it("offers nothing until the map says where it is looking", () => {
    expect(turnings(EMPTY_ROUTE, G, null)).toEqual([]);
  });
});
