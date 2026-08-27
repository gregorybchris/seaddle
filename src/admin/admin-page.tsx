import { useMemo, useState } from "react";
import { boundsOf, padBounds } from "@/lib/geo/bounds";
import type { Bounds, Coord, ElevCoord } from "@/lib/models/geo";
import type { GraphNode } from "@/lib/models/graph";
import { cn } from "@/lib/utilities/style-utils";
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
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [maxDetourRatio, setMaxDetourRatio] = useState(
    DEFAULT_MAX_DETOUR_RATIO,
  );
  const [hint, setHint] = useState<string | null>(null);
  const [focus, setFocus] = useState<{
    bounds: Bounds;
    maxZoom?: number;
  } | null>(null);

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

  function handleMapClick(coord: Coord, segmentId: string | null) {
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
      // Away from any junction, a click on a mapped segment means that
      // segment — the one thing a click here could otherwise not reach.
      if (segmentId) {
        setSelectedSegment(segmentId);
        return;
      }
      setHint("Click a junction, or a mapped segment to select it.");
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

  /** A fresh object every time, so asking for the same place twice still flies. */
  function locateNode(node: GraphNode) {
    setFocus({ bounds: padBounds(boundsOf([node.coord]), 150), maxZoom: 17 });
  }

  function locateSegment(id: string) {
    const points = data.geometry.get(id);
    if (points && points.length > 0) setFocus({ bounds: boundsOf(points) });
  }

  function clearSelection() {
    setFrom(null);
    setTo(null);
    setPreview(null);
    setSelectedNode(null);
    setSelectedSegment(null);
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

  if (data.loading) return <Notice title="Loading rides" waiting />;
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
        selectedSegment={selectedSegment}
        onSelectSegment={setSelectedSegment}
        onLocateNode={locateNode}
        onLocateSegment={locateSegment}
        focusedAt={focus}
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
          segments={data.graph.segments}
          geometry={data.geometry}
          selectedSegmentId={selectedSegment}
          preview={preview}
          focus={focus}
          onMapClick={handleMapClick}
        />
      </main>
    </div>
  );
}

/**
 * A whole-screen state: waiting, or unable to start.
 *
 * Centred as one column rather than left-aligned inside a centred box, which
 * left the mark hanging off the corner of the title instead of belonging to it.
 */
function Notice({
  title,
  children,
  waiting = false,
}: {
  title: string;
  children?: React.ReactNode;
  waiting?: boolean;
}) {
  return (
    <div className="bg-forest flex h-full items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <CycattleMark
          className={cn(
            "text-sand/80 mb-5 h-12 w-12",
            waiting && "animate-[breathe_1.8s_ease-in-out_infinite]",
          )}
        />
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
