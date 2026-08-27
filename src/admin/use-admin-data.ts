import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_GRAPH,
  type GraphFile,
  type SegmentId,
} from "@/lib/models/graph";
import type { ElevCoord } from "@/lib/models/geo";
import type { Track } from "@/lib/models/track";
import { buildTrackIndex } from "./candidate-finder";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/__admin${path}`, init);
  const body = await response.json();
  if (!response.ok || body?.error) {
    throw new Error(body?.error ?? `${path} failed`);
  }
  return body as T;
}

export type AdminData = {
  tracks: Track[];
  graph: GraphFile;
  geometry: Map<SegmentId, ElevCoord[]>;
  loading: boolean;
  error: string | null;
  saving: boolean;
  /** Persist a new graph and, optionally, geometry for one segment. */
  save: (
    graph: GraphFile,
    geometry?: { id: SegmentId; points: ElevCoord[] },
  ) => Promise<void>;
  remove: (graph: GraphFile, id: SegmentId) => Promise<void>;
};

/**
 * The admin's whole world: source rides, the graph, and the geometry on disk.
 *
 * Every change writes the entire graph file back. At a few hundred segments
 * that costs nothing, and it means there is no partial-update path that can
 * leave the file describing something that is not there.
 */
export function useAdminData(): AdminData {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [graph, setGraph] = useState<GraphFile>(EMPTY_GRAPH);
  const [geometry, setGeometry] = useState<Map<SegmentId, ElevCoord[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const [loadedTracks, loadedGraph] = await Promise.all([
          api<Track[]>("/tracks"),
          api<GraphFile>("/graph"),
        ]);
        const entries = await Promise.all(
          loadedGraph.segments.map(
            async (segment) =>
              [
                segment.id,
                await api<ElevCoord[]>(`/geometry/${segment.id}`),
              ] as const,
          ),
        );
        if (canceled) return;
        setTracks(loadedTracks);
        setGraph(loadedGraph);
        setGeometry(new Map(entries));
      } catch (caught) {
        if (!canceled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const save = useCallback(
    async (
      nextGraph: GraphFile,
      nextGeometry?: { id: SegmentId; points: ElevCoord[] },
    ) => {
      setSaving(true);
      setError(null);
      try {
        if (nextGeometry) {
          await api(`/geometry/${nextGeometry.id}`, {
            method: "PUT",
            body: JSON.stringify(nextGeometry.points),
          });
          setGeometry((current) =>
            new Map(current).set(nextGeometry.id, nextGeometry.points),
          );
        }
        await api("/graph", {
          method: "POST",
          body: JSON.stringify(nextGraph),
        });
        setGraph(nextGraph);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const remove = useCallback(async (nextGraph: GraphFile, id: SegmentId) => {
    setSaving(true);
    try {
      await api(`/geometry/${id}`, { method: "DELETE" });
      await api("/graph", { method: "POST", body: JSON.stringify(nextGraph) });
      setGraph(nextGraph);
      setGeometry((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }, []);

  return { tracks, graph, geometry, loading, error, saving, save, remove };
}

/** The spatial index over every track point, rebuilt only when tracks change. */
export function useTrackIndex(tracks: Track[]) {
  return useMemo(
    () => (tracks.length > 0 ? buildTrackIndex(tracks) : null),
    [tracks],
  );
}
