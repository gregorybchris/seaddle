import { useMemo, useState } from "react";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { GraphNode } from "@/lib/models/graph";
import { CycattleMark } from "@/widgets/cycattle-mark";
import {
  DEFAULT_MAX_DETOUR_RATIO,
  DEFAULT_RADIUS_METERS,
  findCandidates,
  type Candidate,
} from "./candidate-finder";
import { AdminMap } from "./components/admin-map";
import { AdminSidebar, type Mode } from "./components/admin-sidebar";
import {
  addSegment,
  placeNode,
  removeSegment,
  snapToNodes,
} from "./extraction";
import { useAdminData, useTrackIndex } from "./use-admin-data";

/** Clicking a junction should be forgiving; the circles are small. */
const SELECT_NODE_METERS = 40;

export default function AdminPage() {
  const data = useAdminData();
  const index = useTrackIndex(data.tracks);
  const [mode, setMode] = useState<Mode>("nodes");
  const [from, setFrom] = useState<GraphNode | null>(null);
  const [to, setTo] = useState<GraphNode | null>(null);
  const [preview, setPreview] = useState<ElevCoord[] | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [maxDetourRatio, setMaxDetourRatio] = useState(
    DEFAULT_MAX_DETOUR_RATIO,
  );
  const [hint, setHint] = useState<string | null>(null);

  const candidates = useMemo(() => {
    if (!index || !from || !to) return null;
    return findCandidates(data.tracks, index, from.coord, to.coord, {
      radiusMeters,
      maxDetourRatio,
    });
  }, [index, from, to, data.tracks, radiusMeters, maxDetourRatio]);

  function handleMapClick(coord: Coord) {
    if (!index) return;
    setHint(null);

    if (mode === "nodes") {
      const placed = placeNode(data.graph, index, data.tracks, coord);
      if (placed.reused) {
        setHint(`That junction already exists — reused ${placed.node.id}.`);
        return;
      }
      if (!placed.onTrack) {
        setHint(
          `${placed.node.id} is not on any ride, so no segment can reach it.`,
        );
      }
      void data.save(placed.graph);
      return;
    }

    const node = snapToNodes(data.graph.nodes, coord, SELECT_NODE_METERS);
    if (!node) {
      setHint("Click a junction. Switch to Junctions to place a new one.");
      return;
    }
    if (!from) {
      setFrom(node);
    } else if (node.id === from.id) {
      setFrom(null);
    } else {
      setTo(node);
    }
  }

  async function chooseCandidate(candidate: Candidate) {
    if (!from || !to) return;
    const added = addSegment(data.graph, candidate, from, to);
    await data.save(added.graph, {
      id: added.segment.id,
      points: added.geometry,
    });
    clearSelection();
  }

  function clearSelection() {
    setFrom(null);
    setTo(null);
    setPreview(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setHint(null);
    clearSelection();
  }

  if (!import.meta.env.VITE_MAPBOX_TOKEN) {
    return (
      <Notice title="Add a Mapbox token">
        Put <code className="tabular">VITE_MAPBOX_TOKEN</code> in{" "}
        <code className="tabular">.env.local</code> and restart the dev server.
        Restrict it by URL to localhost and the production domain — it ships to
        the browser, so that is the only real protection.
      </Notice>
    );
  }

  if (data.loading) return <Notice title="Loading rides" />;
  if (data.error && data.tracks.length === 0) {
    return <Notice title="Could not load the rides">{data.error}</Notice>;
  }

  return (
    <div className="relative h-full md:flex">
      <AdminSidebar
        mode={mode}
        onMode={switchMode}
        trackCount={data.tracks.length}
        nodes={data.graph.nodes}
        segmentIds={data.graph.segments.map((segment) => segment.id)}
        geometry={data.geometry}
        from={from}
        to={to}
        candidates={candidates}
        radiusMeters={radiusMeters}
        maxDetourRatio={maxDetourRatio}
        onRadius={setRadiusMeters}
        onDetour={setMaxDetourRatio}
        hint={hint}
        error={data.error}
        saving={data.saving}
        onHoverGeometry={setPreview}
        onChoose={(candidate) => void chooseCandidate(candidate)}
        onClearSelection={clearSelection}
        onRemoveSegment={(id) =>
          void data.remove(removeSegment(data.graph, id), id)
        }
      />

      <main className="h-full md:min-w-0 md:flex-1">
        <AdminMap
          tracks={data.tracks}
          nodes={data.graph.nodes}
          selectedNodeIds={[from?.id, to?.id].filter(
            (id): id is string => !!id,
          )}
          geometry={data.geometry}
          preview={preview}
          onMapClick={handleMapClick}
        />
      </main>
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-forest flex h-full items-center justify-center p-8">
      <div className="max-w-sm">
        <CycattleMark className="text-sand/80 mb-5 h-10 w-10" />
        <h1 className="text-sand text-lg tracking-[0.14em] uppercase">
          {title}
        </h1>
        {children && (
          <p className="text-sand/70 mt-3 text-sm leading-relaxed">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}
