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
 * One track segment per continuous stretch of riding, which is what a `trkseg`
 * is for. A route that takes the ferry is two of them with the crossing left
 * out: a file carrying a straight line eight miles across Puget Sound is a file
 * that will cheerfully navigate somebody into it, and count the water as
 * distance ridden on the way.
 *
 * No server is involved: the page already holds every point it needs, so
 * exporting is string building plus a Blob. A serverless round trip would add
 * a cold start and an API surface to do arithmetic the client has already done.
 */
export function writeGpx(legs: ElevCoord[][], name: string): string {
  const trksegs = legs
    .map((points) => {
      const trkpts = points
        .map(
          ([lon, lat, ele]) =>
            `      <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`,
        )
        .join("\n");
      return `    <trkseg>\n${trkpts}\n    </trkseg>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Seaddle" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
${trksegs}
  </trk>
</gpx>
`;
}
