import { useEffect, useMemo, useState } from "react";
import { boundsOf, padBounds } from "@/lib/geo/bounds";
import { snapEnds } from "@/lib/geo/polyline";
import { walkOrder } from "@/lib/graph/walk";
import type { Bounds, Coord, ElevCoord } from "@/lib/models/geo";
import type { GraphNode, PinKind } from "@/lib/models/graph";
import { typingIn } from "@/lib/utilities/keys";
import { cn } from "@/lib/utilities/style-utils";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import {
  DEFAULT_MAX_DETOUR_RATIO,
  DEFAULT_RADIUS_METERS,
  findCandidates,
  type Candidate,
} from "./candidate-finder";
import { AdminMap } from "./components/admin-map";
import { AdminSidebar, type Mode } from "./components/admin-sidebar";
import { addPin, pinTarget, removePin, updatePin } from "./pins";
import {
  applyAttributes,
  nextUnreviewed,
  stepSegment,
  swapSegmentDirection,
  type AttributePatch,
} from "./review";
import {
  addSegment,
  mergeNodes,
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
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  /** A junction waiting to swallow the next one clicked. */
  const [merging, setMerging] = useState<GraphNode | null>(null);
  const [dropping, setDropping] = useState<PinKind | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
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

  /**
   * Segments in the order the roads run, rather than the order they were cut.
   *
   * The sidebar lists this and the step buttons walk it, so during a review
   * pass "next" is the segment you would have ridden onto — which is what
   * makes it possible to judge how protected a road is without zooming out
   * first to remember where it was. Ids record when a segment was extracted
   * and say nothing about where it is.
   *
   * Only topology and geometry decide the order, so entering attributes never
   * reshuffles the list under the pass that is entering them.
   */
  const orderedSegments = useMemo(() => {
    const byId = new Map(data.graph.segments.map((s) => [s.id, s]));
    const order = walkOrder(
      data.graph.segments.map((segment) => ({
        id: segment.id,
        from: segment.from,
        to: segment.to,
        points: data.geometry.get(segment.id) ?? [],
      })),
    );
    return order.flatMap((id) => byId.get(id) ?? []);
  }, [data.graph.segments, data.geometry]);

  function handleMapClick(
    coord: Coord,
    segmentId: string | null,
    additive: boolean,
  ) {
    if (!index) return;
    setHint(null);

    // Dropping a pin asks which road and how far along at once, so it comes
    // before anything that only wants the coordinate.
    if (dropping) {
      const target = pinTarget(data.geometry, coord);
      if (!target) {
        setHint("Pins go on a mapped segment. Click closer to one.");
        return;
      }
      const added = addPin(
        data.graph,
        target.segment,
        target.at,
        dropping,
        coord,
      );
      setDropping(null);
      setSelectedPin(added.pin.id);
      void data.save(added.graph);
      return;
    }

    if (mode === "nodes") {
      // Within the dedup radius the click means the junction already there, so
      // select it rather than silently doing nothing.
      const existing = snapToNodes(data.graph.nodes, coord, NODE_SNAP_METERS);

      // A merge is armed: the next junction clicked folds into the armed one.
      if (merging && existing && existing.id !== merging.id) {
        void foldInto(merging, existing);
        return;
      }

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
        // Shift or command adds to the selection, so a whole trail can be
        // judged in one answer instead of forty.
        setSelectedSegments((current) =>
          additive
            ? current.includes(segmentId)
              ? current.filter((id) => id !== segmentId)
              : [...current, segmentId]
            : [segmentId],
        );
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
    setSelectedSegments([]);
  }

  function patchSelected(patch: AttributePatch) {
    if (selectedSegments.length === 0) return;
    void data.save(applyAttributes(data.graph, selectedSegments, patch));
  }

  /**
   * Fold one junction into another, and re-pin what moved.
   *
   * The records alone are not enough: a segment moved to a new junction still
   * ends where the old one was, and would draw a gap at the very crossing the
   * merge was meant to close.
   */
  async function foldInto(keep: GraphNode, drop: GraphNode) {
    const { graph, moved } = mergeNodes(data.graph, keep.id, drop.id);
    setMerging(null);
    setSelectedNode(keep);
    for (const id of moved) {
      const segment = graph.segments.find((one) => one.id === id);
      const points = data.geometry.get(id);
      if (!segment || !points) continue;
      const from = graph.nodes.find((one) => one.id === segment.from);
      const to = graph.nodes.find((one) => one.id === segment.to);
      if (!from || !to) continue;
      await data.save(graph, {
        id,
        points: snapEnds(points, from.coord, to.coord),
      });
    }
    if (moved.length === 0) await data.save(graph);
    setHint(`Folded ${drop.id} into ${keep.id}.`);
  }

  /**
   * Turn the selected segment around, geometry and all.
   *
   * The stored points have to be reversed alongside the record, or the drawn
   * line would still run the old way while everything describing it said
   * otherwise.
   */
  async function swapSelected() {
    if (selectedSegments.length !== 1) return;
    const id = selectedSegments[0];
    const points = data.geometry.get(id);
    if (!points) return;
    await data.save(swapSegmentDirection(data.graph, id), {
      id,
      points: [...points].reverse(),
    });
  }

  /** Hand over the next segment still carrying defaults, and go look at it. */
  function goToNextUnreviewed() {
    const after = selectedSegments.length === 1 ? selectedSegments[0] : null;
    const next = nextUnreviewed(orderedSegments, after);
    if (!next) {
      setHint("Every segment has been reviewed.");
      return;
    }
    setHint(null);
    setSelectedSegments([next]);
    locateSegment(next);
  }

  /** Walk to the neighboring segment, so a judgment can be gone back to. */
  function goToStep(delta: 1 | -1) {
    const from = selectedSegments.length === 1 ? selectedSegments[0] : null;
    const to = stepSegment(orderedSegments, from, delta);
    if (!to) return;
    setHint(null);
    setSelectedSegments([to]);
    locateSegment(to);
  }

  // A and D walk the pass, the same two steps as the caret buttons. A review
  // is a hand on the mouse to pick roads apart and a hand on the keys to judge
  // them, so moving on shouldn't cost a trip back to a 20px button. Bound here
  // rather than in the panel so the keys cannot drift from the buttons; no
  // dependency list, since the effect closes over the selection it steps from.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (typingIn(event.target)) return;

      const key = event.key.toLowerCase();
      if (key !== "a" && key !== "d") return;
      goToStep(key === "d" ? 1 : -1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
        segments={orderedSegments}
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
        pins={data.graph.pins}
        selectedPin={
          data.graph.pins.find((pin) => pin.id === selectedPin) ?? null
        }
        onSelectPin={setSelectedPin}
        dropping={dropping}
        onDropping={setDropping}
        onPinKind={(kind) =>
          selectedPin &&
          void data.save(updatePin(data.graph, selectedPin, { kind }))
        }
        onPinNote={(note) =>
          selectedPin &&
          void data.save(updatePin(data.graph, selectedPin, { note }))
        }
        onRemovePin={() => {
          if (!selectedPin) return;
          void data.save(removePin(data.graph, selectedPin));
          setSelectedPin(null);
        }}
        onLocatePin={(pin) =>
          setFocus({
            bounds: padBounds(boundsOf([pin.coord]), 120),
            maxZoom: 18,
          })
        }
        merging={merging}
        onArmMerge={setMerging}
        selectedSegments={selectedSegments}
        onSelectSegments={setSelectedSegments}
        onPatchSelected={patchSelected}
        onSwapSelected={() => void swapSelected()}
        onNextUnreviewed={goToNextUnreviewed}
        onStepSegment={goToStep}
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
          selectedSegmentIds={selectedSegments}
          pins={data.graph.pins}
          selectedPinId={selectedPin}
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
 * Centered as one column rather than left-aligned inside a centered box, which
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
        <SeaddleMark
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
