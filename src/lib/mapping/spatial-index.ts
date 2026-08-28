import { padBounds } from "@/lib/geo/bounds";
import {
  haversineMeters,
  metersPerDegreeLat,
  metersPerDegreeLon,
} from "@/lib/geo/distance";
import type { Bounds, Coord } from "@/lib/models/geo";

type Cell<T> = { coord: Coord; item: T }[];

/**
 * A uniform grid over coordinates, for "everything within R meters of here".
 *
 * The admin asks this of ~50,000 track points every time you click a junction,
 * and scanning them all would be visible. Cells are sized to the query radius,
 * so a query only ever has to look at the 3×3 block around its center.
 *
 * Adapted from an earlier project's QueryEngine, with one change: that version
 * inserted every point into all nine of its neighboring cells, which made the
 * index nine times larger than the data. Fanning out at query time instead of
 * insert time gives the same answers.
 */
export class SpatialIndex<T> {
  private readonly cells: Map<string, Cell<T>> = new Map();
  private readonly bounds: Bounds;
  private readonly cellMeters: number;
  private readonly cellLon: number;
  private readonly cellLat: number;

  constructor(
    entries: { coord: Coord; item: T }[],
    cellMeters: number,
    bounds?: Bounds,
  ) {
    this.cellMeters = cellMeters;
    const raw = bounds ?? boundsOfEntries(entries);
    this.bounds = padBounds(raw, cellMeters);
    const midLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    this.cellLat = cellMeters / metersPerDegreeLat();
    this.cellLon = cellMeters / metersPerDegreeLon(midLat);
    for (const entry of entries) this.insert(entry);
  }

  private key(coord: Coord): string {
    const col = Math.floor((coord[0] - this.bounds.minLon) / this.cellLon);
    const row = Math.floor((coord[1] - this.bounds.minLat) / this.cellLat);
    return `${row}:${col}`;
  }

  private insert(entry: { coord: Coord; item: T }): void {
    const key = this.key(entry.coord);
    const cell = this.cells.get(key);
    if (cell) cell.push(entry);
    else this.cells.set(key, [entry]);
  }

  /**
   * Everything within `radiusMeters`, nearest first.
   *
   * The radius must not exceed the cell size the index was built with, or the
   * 3×3 block stops being enough to contain the answer.
   */
  within(
    coord: Coord,
    radiusMeters: number,
  ): { item: T; coord: Coord; distanceMeters: number }[] {
    if (radiusMeters > this.cellMeters) {
      throw new Error(
        `Query radius ${radiusMeters}m exceeds the index cell size ${this.cellMeters}m`,
      );
    }
    const col = Math.floor((coord[0] - this.bounds.minLon) / this.cellLon);
    const row = Math.floor((coord[1] - this.bounds.minLat) / this.cellLat);

    const hits: { item: T; coord: Coord; distanceMeters: number }[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cell = this.cells.get(`${row + dr}:${col + dc}`);
        if (!cell) continue;
        for (const entry of cell) {
          const distanceMeters = haversineMeters(entry.coord, coord);
          if (distanceMeters <= radiusMeters) {
            hits.push({ item: entry.item, coord: entry.coord, distanceMeters });
          }
        }
      }
    }
    return hits.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  nearest(
    coord: Coord,
    radiusMeters: number,
  ): { item: T; coord: Coord; distanceMeters: number } | null {
    return this.within(coord, radiusMeters)[0] ?? null;
  }
}

function boundsOfEntries(entries: { coord: Coord }[]): Bounds {
  if (entries.length === 0) {
    return { minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 };
  }
  let [minLon, minLat] = [Infinity, Infinity];
  let [maxLon, maxLat] = [-Infinity, -Infinity];
  for (const { coord } of entries) {
    if (coord[0] < minLon) minLon = coord[0];
    if (coord[1] < minLat) minLat = coord[1];
    if (coord[0] > maxLon) maxLon = coord[0];
    if (coord[1] > maxLat) maxLat = coord[1];
  }
  return { minLon, minLat, maxLon, maxLat };
}
