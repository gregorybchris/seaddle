import type { Map as MapboxMap } from "mapbox-gl";
import { describe, expect, it } from "vitest";
import { applyBasemap, BASEMAPS, DEFAULT_BASEMAP } from "./basemap";

type Call = { layer: string; property: string; value: unknown };

/**
 * A map that behaves like the real one in the way that matters here.
 *
 * The setters are prototype methods rather than arrow properties, because the
 * bug this file exists to prevent was a call that lost its receiver: a detached
 * `setPaintProperty` runs with `this` undefined, throws inside mapbox-gl, and —
 * being called straight from a React effect — took the whole tree down with it.
 * A fake that reads `this` catches that; an object literal of arrows would not.
 */
class FakeMap {
  paint: Call[] = [];
  layout: Call[] = [];
  /** Which layers the style has — `"all"` for a complete one. */
  constructor(private readonly layers: Set<string> | "all") {}

  getLayer(id: string) {
    const has = this.layers === "all" || this.layers.has(id);
    return has ? { id } : undefined;
  }

  setPaintProperty(layer: string, property: string, value: unknown) {
    this.paint.push({ layer, property, value });
  }

  setLayoutProperty(layer: string, property: string, value: unknown) {
    this.layout.push({ layer, property, value });
  }
}

/** A style holding every layer, which is what light-v11 is. */
function fullStyle(): FakeMap {
  return new FakeMap("all");
}

describe("applyBasemap", () => {
  it("keeps the setter attached to the map", () => {
    // The regression guard: a detached setter throws on `this`, so reaching the
    // assertion at all is most of the test.
    const map = fullStyle();
    expect(() =>
      applyBasemap(map as unknown as MapboxMap, BASEMAPS[0]),
    ).not.toThrow();
    expect(map.paint.length).toBeGreaterThan(0);
  });

  it("applies every theme without throwing", () => {
    for (const basemap of BASEMAPS) {
      const map = fullStyle();
      expect(() =>
        applyBasemap(map as unknown as MapboxMap, basemap),
      ).not.toThrow();
    }
  });

  it("writes the same properties for every theme, so a switch leaves no residue", () => {
    const key = (call: Call) => `${call.layer}/${call.property}`;
    const first = new Set(
      (() => {
        const map = fullStyle();
        applyBasemap(map as unknown as MapboxMap, BASEMAPS[0]);
        return map.paint.map(key);
      })(),
    );

    for (const basemap of BASEMAPS.slice(1)) {
      const map = fullStyle();
      applyBasemap(map as unknown as MapboxMap, basemap);
      expect(new Set(map.paint.map(key))).toEqual(first);
    }
  });

  it("never sets an undefined color", () => {
    for (const basemap of BASEMAPS) {
      const map = fullStyle();
      applyBasemap(map as unknown as MapboxMap, basemap);
      for (const call of map.paint) {
        expect(call.value, `${basemap.id} ${key(call)}`).toBeDefined();
      }
    }
    function key(call: Call) {
      return `${call.layer}/${call.property}`;
    }
  });

  it("skips layers the style does not have", () => {
    const map = new FakeMap(new Set(["water"]));
    applyBasemap(map as unknown as MapboxMap, BASEMAPS[0]);
    expect(map.paint.every((call) => call.layer === "water")).toBe(true);
  });

  it("shows landmarks only where a theme asks for them", () => {
    for (const basemap of BASEMAPS) {
      const map = fullStyle();
      applyBasemap(map as unknown as MapboxMap, basemap);
      const visibility = map.layout.find(
        (call) => call.layer === "poi-label",
      )?.value;
      expect(visibility).toBe(basemap.palette.poi ? "visible" : "none");
    }
  });
});

describe("BASEMAPS", () => {
  it("has a theme matching the default", () => {
    expect(BASEMAPS.some((basemap) => basemap.id === DEFAULT_BASEMAP)).toBe(
      true,
    );
  });

  it("has no duplicate ids or names", () => {
    expect(new Set(BASEMAPS.map((b) => b.id)).size).toBe(BASEMAPS.length);
    expect(new Set(BASEMAPS.map((b) => b.name)).size).toBe(BASEMAPS.length);
  });
});
