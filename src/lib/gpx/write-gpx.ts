import type { ElevCoord } from "@/lib/models/geo";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Turn an assembled route into a GPX file, in the browser.
 *
 * No server is involved: the page already holds every point it needs, so
 * exporting is string building plus a Blob. A serverless round trip would add
 * a cold start and an API surface to do arithmetic the client has already done.
 */
export function writeGpx(points: ElevCoord[], name: string): string {
  const trkpts = points
    .map(
      ([lon, lat, ele]) =>
        `      <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Seaddle" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}
