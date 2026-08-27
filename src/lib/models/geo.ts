/** A position on the map. Longitude first, matching GeoJSON. */
export type Coord = [lon: number, lat: number];

/** A track point. Elevation is in meters, as GPX stores it. */
export type ElevCoord = [lon: number, lat: number, ele: number];

export type Bounds = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};
