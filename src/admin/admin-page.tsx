import { useMemo, useState } from "react";
import { polylineMeters } from "@/lib/geo/polyline";
import type { Coord, ElevCoord } from "@/lib/models/geo";
import type { GraphNode } from "@/lib/models/graph";
import { formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import {
  DEFAULT_MAX_DETOUR_RATIO,
  DEFAULT_RADIUS_METERS,
  findCandidates,
  type Candidate,
} from "./candidate-finder";
import { AdminMap } from "./components/admin-map";
import { CandidateList } from "./components/candidate-list";
import {
  addSegment,
  placeNode,
  removeSegment,
  snapToNodes,
} from "./extraction";
import { useAdminData, useTrackIndex } from "./use-admin-data";

/** Clicking a junction should be forgiving; the circles are small. */
const SELECT_NODE_METERS = 40;

type Mode = "nodes" | "segments";

export default function AdminPage() {
  const data = useAdminData();
  const index = useTrackIndex(data.tracks);
  const [mode, setMode] = useState<Mode>("nodes");
  const [from, setFrom] = useState<GraphNode | null>(null);
  const [to, setTo] = useState<GraphNode | null>(null);
  const [preview, setPreview] = useState<ElevCoord[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
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
        setHint(`Reused ${placed.node.id} — that junction already exists.`);
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
    setExpanded(null);
  }

  const totalMeters = [...data.geometry.values()].reduce(
    (sum, points) => sum + polylineMeters(points),
    0,
  );

  if (!import.meta.env.VITE_MAPBOX_TOKEN) {
    return (
      <Notice title="No Mapbox token">
        Put <code>VITE_MAPBOX_TOKEN</code> in <code>.env.local</code> and
        restart the dev server. Restrict it by URL to localhost and the
        production domain — it ships to the browser, so that is the only real
        protection.
      </Notice>
    );
  }

  if (data.loading) return <Notice title="Loading rides…" />;
  if (data.error && data.tracks.length === 0) {
    return <Notice title="Could not load">{data.error}</Notice>;
  }

  return (
    <div className="flex h-full flex-col-reverse md:flex-row">
      <aside className="border-ink/10 bg-paper flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t p-4 md:w-96 md:border-t-0 md:border-r">
        <header>
          <h1 className="text-forest text-xl">Cycattle admin</h1>
          <p className="text-ink/50 text-xs">
            {data.tracks.length} rides · {data.graph.nodes.length} junctions ·{" "}
            {data.graph.segments.length} segments · {formatMiles(totalMeters)}
          </p>
        </header>

        <div className="flex gap-2">
          <Button
            selected={mode === "nodes"}
            onClick={() => {
              setMode("nodes");
              clearSelection();
            }}
          >
            Junctions
          </Button>
          <Button
            selected={mode === "segments"}
            onClick={() => {
              setMode("segments");
              clearSelection();
            }}
          >
            Segments
          </Button>
          {data.saving && (
            <span className="text-ink/40 self-center text-xs">saving…</span>
          )}
        </div>

        {hint && (
          <p className="border-bark/40 bg-sand/60 rounded border-2 p-2 text-xs">
            {hint}
          </p>
        )}
        {data.error && (
          <p className="rounded border-2 border-red-300 bg-red-50 p-2 text-xs text-red-800">
            {data.error}
          </p>
        )}

        {mode === "nodes" ? (
          <p className="text-ink/60 text-sm">
            Click where rides cross. The click snaps onto the nearest ride, and
            onto an existing junction if one is close — so clicking the same
            intersection twice gives you one junction, not two.
          </p>
        ) : (
          <SegmentPanel
            from={from}
            to={to}
            candidates={candidates}
            radiusMeters={radiusMeters}
            maxDetourRatio={maxDetourRatio}
            onRadius={setRadiusMeters}
            onDetour={setMaxDetourRatio}
            onHover={(candidate) => setPreview(candidate?.points ?? null)}
            onChoose={(candidate) => void chooseCandidate(candidate)}
            onClear={clearSelection}
            expanded={expanded}
            onExpand={setExpanded}
          />
        )}

        <SegmentList
          ids={data.graph.segments.map((segment) => segment.id)}
          geometry={data.geometry}
          onHover={(points) => setPreview(points)}
          onRemove={(id) => void data.remove(removeSegment(data.graph, id), id)}
        />
      </aside>

      <main className="min-h-0 flex-1">
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

type SegmentPanelProps = {
  from: GraphNode | null;
  to: GraphNode | null;
  candidates: Candidate[] | null;
  radiusMeters: number;
  maxDetourRatio: number;
  onRadius: (value: number) => void;
  onDetour: (value: number) => void;
  onHover: (candidate: Candidate | null) => void;
  onChoose: (candidate: Candidate) => void;
  onClear: () => void;
  expanded: string | null;
  onExpand: (track: string | null) => void;
};

function SegmentPanel({
  from,
  to,
  candidates,
  radiusMeters,
  maxDetourRatio,
  onRadius,
  onDetour,
  onHover,
  onChoose,
  onClear,
  expanded,
  onExpand,
}: SegmentPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink/60 text-sm">
        {!from
          ? "Click the junction the segment starts at."
          : !to
            ? `From ${from.id}. Now click the junction it ends at.`
            : `${from.id} → ${to.id}. Hover a candidate to preview it.`}
      </p>

      {from && (
        <Button variant="quiet" className="self-start" onClick={onClear}>
          Clear selection
        </Button>
      )}

      <details className="text-xs">
        <summary className="text-ink/60 cursor-pointer">
          Search settings
        </summary>
        <label className="mt-2 block">
          Search radius: {radiusMeters} m
          <input
            type="range"
            min={10}
            max={100}
            value={radiusMeters}
            onChange={(event) => onRadius(Number(event.target.value))}
            className="w-full"
          />
        </label>
        <label className="block">
          Max detour: ×{maxDetourRatio.toFixed(1)}
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={maxDetourRatio}
            onChange={(event) => onDetour(Number(event.target.value))}
            className="w-full"
          />
        </label>
      </details>

      {candidates && (
        <CandidateList
          candidates={candidates}
          onHover={onHover}
          onChoose={onChoose}
          expanded={expanded}
          onExpand={onExpand}
        />
      )}
    </div>
  );
}

type SegmentListProps = {
  ids: string[];
  geometry: Map<string, ElevCoord[]>;
  onHover: (points: ElevCoord[] | null) => void;
  onRemove: (id: string) => void;
};

function SegmentList({ ids, geometry, onHover, onRemove }: SegmentListProps) {
  if (ids.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-ink/50 text-xs uppercase">Segments</h2>
      <ul className="flex flex-col gap-1">
        {ids.map((id) => (
          <li
            key={id}
            className="border-ink/10 flex items-center justify-between rounded border px-2 py-1 text-xs"
            onMouseEnter={() => onHover(geometry.get(id) ?? null)}
            onMouseLeave={() => onHover(null)}
          >
            <span>{id}</span>
            <span className="text-ink/50">
              {formatMiles(polylineMeters(geometry.get(id) ?? []))}
            </span>
            <Button
              variant="quiet"
              className="px-2 py-0.5 text-xs"
              onClick={() => onRemove(id)}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </section>
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
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md">
        <h1 className="text-forest text-xl">{title}</h1>
        {children && <p className="text-ink/70 mt-2 text-sm">{children}</p>}
      </div>
    </div>
  );
}
