import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import type { Coord } from "@/lib/models/geo";
import { isPinKind, type PinKind } from "@/lib/models/graph";
import { parseGraph, type SiteGraph } from "./graph-data";

/** A point of interest as the site holds it. */
export type SitePin = {
  id: string;
  segment: string;
  kind: PinKind;
  note: string | null;
  at: number;
  coord: Coord;
};

/**
 * The compiled graph, fetched rather than bundled.
 *
 * It is a static file beside the app, so it caches on its own terms and the
 * page can paint before it arrives — the sidebar and its shell do not need the
 * network, only the map does.
 */
export function useGraph() {
  const [graph, setGraph] = useState<SiteGraph | null>(null);
  const [pins, setPins] = useState<SitePin[]>([]);
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

  // Pins are a separate file and a smaller one, and a map without them is
  // still a map — so a failure here is quietly nothing rather than an error
  // across the whole page.
  useEffect(() => {
    let cancelled = false;
    fetch("/pins.geojson")
      .then((response) => (response.ok ? response.json() : null))
      .then((collection: FeatureCollection | null) => {
        if (cancelled || !collection) return;
        setPins(
          collection.features.flatMap((feature) => {
            const p = feature.properties;
            const where = feature.geometry;
            if (!p?.id || where.type !== "Point") return [];
            // Dropping one pin the build cannot draw, rather than rendering an
            // icon that does not exist and losing the map with it.
            if (!isPinKind(p.kind)) return [];
            return [
              {
                id: String(p.id),
                segment: String(p.segment),
                kind: p.kind,
                note: p.note ? String(p.note) : null,
                at: Number(p.at ?? 0),
                coord: where.coordinates as Coord,
              },
            ];
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return { graph, pins, error };
}
