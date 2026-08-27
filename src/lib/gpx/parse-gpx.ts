import { XMLParser } from "fast-xml-parser";
import type { ElevCoord } from "@/lib/models/geo";

export type ParsedGpx = {
  name: string | null;
  points: ElevCoord[];
  /**
   * When each point was recorded, in epoch milliseconds, or null throughout for
   * a route that was drawn rather than ridden. Same length as `points`.
   *
   * This is what separates "the rider went in a straight line here" from "the
   * recorder was not running here" — the two look identical in the coordinates
   * alone.
   */
  times: (number | null)[];
  /**
   * When the ride happened, ISO 8601, or null for a route that was drawn.
   *
   * Kept as a string because it is displayed far more often than it is
   * computed with, and ISO sorts chronologically as plain text.
   */
  recordedAt: string | null;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Read the track points out of a GPX document.
 *
 * Build-time only — the site never parses GPX, it only writes it. Attribute
 * order varies by exporter (Mapometer writes lon before lat), so points are
 * read by name; positional parsing would silently swap the hemisphere.
 */
export function parseGpx(xml: string): ParsedGpx {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
  });
  const gpx = parser.parse(xml)?.gpx;
  if (!gpx) throw new Error("No <gpx> root element");

  const points: ElevCoord[] = [];
  const times: (number | null)[] = [];
  for (const trk of asArray(gpx.trk)) {
    for (const trkseg of asArray(trk.trkseg)) {
      for (const trkpt of asArray(trkseg.trkpt)) {
        const lon = Number(trkpt["@_lon"]);
        const lat = Number(trkpt["@_lat"]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
        const ele = Number(trkpt.ele);
        points.push([lon, lat, Number.isFinite(ele) ? ele : 0]);
        const at = trkpt.time ? Date.parse(String(trkpt.time)) : NaN;
        times.push(Number.isFinite(at) ? at : null);
      }
    }
  }

  const rawName = gpx.metadata?.name ?? asArray(gpx.trk)[0]?.name ?? null;
  const name = rawName === null ? null : String(rawName).trim();

  // The metadata stamp if there is one, otherwise the first point that carries
  // a time — some exporters give one and not the other.
  const stamp = gpx.metadata?.time ?? null;
  const firstTime = times.find((time) => time !== null) ?? null;
  const recordedAt = stamp
    ? new Date(String(stamp)).toISOString()
    : firstTime !== null
      ? new Date(firstTime).toISOString()
      : null;

  return { name: name || null, points, times, recordedAt };
}
