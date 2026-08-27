import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { parseGraph, type SiteGraph } from "./graph-data";

/**
 * The compiled graph, fetched rather than bundled.
 *
 * It is a static file beside the app, so it caches on its own terms and the
 * page can paint before it arrives — the sidebar and its shell do not need the
 * network, only the map does.
 */
export function useGraph() {
  const [graph, setGraph] = useState<SiteGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    fetch("/graph.geojson")
      .then((response) => {
        if (!response.ok)
          throw new Error(`Could not load the map (${response.status})`);
        return response.json() as Promise<FeatureCollection>;
      })
      .then((collection) => {
        if (!canceled) setGraph(parseGraph(collection));
      })
      .catch((caught: unknown) => {
        if (!canceled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  return { graph, error };
}
