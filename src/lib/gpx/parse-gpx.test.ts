import { describe, expect, it } from "vitest";
import { parseGpx } from "./parse-gpx";

const MINIMAL = `<?xml version="1.0"?>
<gpx version="1.1">
  <metadata><name><![CDATA[Green Lake]]></name></metadata>
  <trk><trkseg>
    <trkpt lon="-122.331" lat="47.68"><ele>8.7</ele></trkpt>
    <trkpt lon="-122.3309" lat="47.6799"><ele>8.8</ele></trkpt>
  </trkseg></trk>
</gpx>`;

describe("parseGpx", () => {
  it("reads points by attribute name, not position", () => {
    // Mapometer writes lon before lat. Reading positionally would put these
    // rides in Kazakhstan.
    const { points } = parseGpx(MINIMAL);
    expect(points[0]).toEqual([-122.331, 47.68, 8.7]);
  });

  it("pulls the name out of CDATA", () => {
    expect(parseGpx(MINIMAL).name).toBe("Green Lake");
  });

  it("falls back to the track name when there is no metadata name", () => {
    const xml = `<gpx><trk><name>Alki</name><trkseg>
      <trkpt lat="47.6" lon="-122.4"><ele>3</ele></trkpt>
    </trkseg></trk></gpx>`;
    expect(parseGpx(xml).name).toBe("Alki");
  });

  it("returns a null name rather than an empty one", () => {
    const xml = `<gpx><metadata><name></name></metadata><trk><trkseg>
      <trkpt lat="47.6" lon="-122.4"/>
    </trkseg></trk></gpx>`;
    expect(parseGpx(xml).name).toBeNull();
  });

  it("joins multiple track segments into one line", () => {
    const xml = `<gpx><trk>
      <trkseg><trkpt lat="47.6" lon="-122.4"><ele>1</ele></trkpt></trkseg>
      <trkseg><trkpt lat="47.7" lon="-122.3"><ele>2</ele></trkpt></trkseg>
    </trk></gpx>`;
    expect(parseGpx(xml).points).toHaveLength(2);
  });

  it("defaults a missing elevation to zero rather than NaN", () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="47.6" lon="-122.4"/>
    </trkseg></trk></gpx>`;
    expect(parseGpx(xml).points[0][2]).toBe(0);
  });

  it("skips a point with unreadable coordinates", () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="nope" lon="-122.4"><ele>1</ele></trkpt>
      <trkpt lat="47.6" lon="-122.4"><ele>1</ele></trkpt>
    </trkseg></trk></gpx>`;
    expect(parseGpx(xml).points).toHaveLength(1);
  });

  it("reads the time each point was recorded", () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="47.6" lon="-122.4"><ele>1</ele><time>2026-07-06T16:18:54Z</time></trkpt>
    </trkseg></trk></gpx>`;
    expect(parseGpx(xml).times).toEqual([Date.parse("2026-07-06T16:18:54Z")]);
  });

  it("gives a null time per point for a route that was drawn", () => {
    // Which is the whole signal: no timestamps means nobody rode this, so its
    // long straight legs are deliberate rather than a recorder switched off.
    expect(parseGpx(MINIMAL).times).toEqual([null, null]);
  });

  it("refuses a document that is not GPX", () => {
    expect(() => parseGpx("<html></html>")).toThrow(/No <gpx> root/);
  });
});
