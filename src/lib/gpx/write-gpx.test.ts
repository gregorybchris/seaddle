import { describe, expect, it } from "vitest";
import { line } from "@/lib/graph/test-fixtures";
import { writeGpx } from "./write-gpx";

describe("writeGpx", () => {
  const gpx = writeGpx(line([0, 10, 20]), "Ballard loop");

  it("writes one track point per coordinate", () => {
    expect(gpx.match(/<trkpt/g)).toHaveLength(3);
  });

  it("writes latitude and longitude the way GPX readers expect", () => {
    expect(gpx).toContain('<trkpt lat="47.68" lon="-122.33">');
  });

  it("carries elevation, which is half the reason to export at all", () => {
    expect(gpx).toContain("<ele>20</ele>");
  });

  it("names the file and the track", () => {
    expect(gpx.match(/<name>Ballard loop<\/name>/g)).toHaveLength(2);
  });

  it("escapes a name that would otherwise break the XML", () => {
    const escaped = writeGpx(line(), 'Fremont & "Gas Works" <loop>');
    expect(escaped).toContain(
      "<name>Fremont &amp; &quot;Gas Works&quot; &lt;loop&gt;</name>",
    );
    expect(escaped).not.toContain("<loop>");
  });

  it("produces a single well-formed document", () => {
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx.trimEnd().endsWith("</gpx>")).toBe(true);
  });
});
