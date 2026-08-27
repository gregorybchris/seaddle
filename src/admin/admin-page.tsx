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
  NODE_SNAP_METERS,
  placeNode,
  removeNode,
  removeSegment,
  renameNode,
  renameSegment,
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
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [maxDetourRatio, setMaxDetourRatio] = useState(
    DEFAULT_MAX_DETOUR_RATIO,
  );
  const [hint, setHint] = useState<string | null>(null);

  // A fresh array every render would re-upload the node layer on every
  // keystroke elsewhere in the panel.
  const selectedNodeIds = useMemo(
    () =>
      [from?.id, to?.id, selectedNode?.id].filter(
        (id): id is string => id !== undefined,
      ),
    [from, to, selectedNode],
  );

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
      // Within the dedup radius the click means the junction already there, so
      // select it rather than silently doing nothing.
      const existing = snapToNodes(data.graph.nodes, coord, NODE_SNAP_METERS);
      if (existing) {
        setSelectedNode(existing.id === selectedNode?.id ? null : existing);
        return;
      }
      const placed = placeNode(data.graph, index, data.tracks, coord);
      if (!placed.onTrack) {
        // Nothing can ever be extracted to a junction no ride passes, so
        // saving one just leaves rubbish to find and delete later.
        setHint("No ride runs near there. Zoom in and click on a line.");
        return;
      }
      setSelectedNode(placed.node);
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
    setSelectedNode(null);
  }

  function deleteNode(id: string) {
    const removal = removeNode(data.graph, id);
    if (removal.blockedBy.length > 0) {
      setHint(
        `${id} still carries ${removal.blockedBy.join(", ")}. Delete ${
          removal.blockedBy.length > 1 ? "those segments" : "that segment"
        } first.`,
      );
      return;
    }
    setHint(null);
    if (selectedNode?.id === id) setSelectedNode(null);
    void data.save(removal.graph);
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
        segments={data.graph.segments}
        geometry={data.geometry}
        from={from}
        to={to}
        selectedNode={selectedNode}
        onSelectNode={setSelectedNode}
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
        onRenameSegment={(id, name) =>
          void data.save(renameSegment(data.graph, id, name))
        }
        onRemoveNode={deleteNode}
        onRenameNode={(id, name) =>
          void data.save(renameNode(data.graph, id, name))
        }
      />

      <main className="h-full md:min-w-0 md:flex-1">
        <AdminMap
          tracks={data.tracks}
          nodes={data.graph.nodes}
          selectedNodeIds={selectedNodeIds}
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
