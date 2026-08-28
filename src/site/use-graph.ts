import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  parseGraph,
  parsePins,
  type SiteGraph,
  type SitePin,
} from "./graph-data";

/**
 * Fetch one of the compiled GeoJSON files and hand back what it parses to.
 *
 * The two files are fetched the same way and differ only in what a failure
 * means, so that is the one thing the caller decides: `onError` is given the
 * reason, and a caller that can do without the file passes nothing.
 */
function useCompiled<T>(
  path: string,
  parse: (collection: FeatureCollection) => T,
  onError?: (reason: string) => void,
): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    let canceled = false;
    fetch(path)
      .then((response) => {
        if (!response.ok)
          throw new Error(`Could not load the map (${response.status})`);
        return response.json() as Promise<FeatureCollection>;
      })
      .then((collection) => {
        if (!canceled) setValue(parse(collection));
      })
      .catch((caught: unknown) => {
        if (!canceled) {
          onError?.(caught instanceof Error ? caught.message : String(caught));
        }
      });
    return () => {
      canceled = true;
    };
  }, [path, parse, onError]);

  return value;
}

/** One list, so a map with no pins does not look like a new one each render. */
const NO_PINS: SitePin[] = [];

/**
 * The compiled graph, fetched rather than bundled.
 *
 * It is a static file beside the app, so it caches on its own terms and the
 * page can paint before it arrives — the sidebar and its shell do not need the
 * network, only the map does.
 *
 * Pins are a separate file and a smaller one, and a map without them is still a
 * map — so a failure there is quietly nothing rather than an error across the
 * whole page.
 */
export function useGraph() {
  const [error, setError] = useState<string | null>(null);
  const graph = useCompiled<SiteGraph>("/graph.geojson", parseGraph, setError);
  const pins = useCompiled<SitePin[]>("/pins.geojson", parsePins);

  return { graph, pins: pins ?? NO_PINS, error };
}
