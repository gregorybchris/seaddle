import { writeGpx } from "@/lib/gpx/write-gpx";
import type { ElevCoord } from "@/lib/models/geo";

/**
 * Hand the rider the file, from the browser.
 *
 * No server is involved: the page already holds every point it needs, so this
 * is string building and a Blob. A round trip would add a cold start to do
 * arithmetic that has already been done here.
 */
export function downloadGpx(points: ElevCoord[], name: string): void {
  const url = URL.createObjectURL(
    new Blob([writeGpx(points, name)], { type: "application/gpx+xml" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(name)}.gpx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "route"
  );
}
