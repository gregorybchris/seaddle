import { useMemo, useState } from "react";
import type { ElevCoord } from "@/lib/models/geo";
import type {
  GraphNode,
  Pin,
  PinKind,
  SegmentRecord,
} from "@/lib/models/graph";
import { polylineMeters } from "@/lib/geo/polyline";
import { cn } from "@/lib/utilities/style-utils";
import { formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { Segmented } from "@/widgets/segmented";
import { Sheet } from "@/widgets/sheet";
import { CollapsibleSection } from "@/widgets/collapsible-section";
import { PinEditor } from "./pin-editor";
import { SegmentEditor } from "./segment-editor";
import type { AttributePatch } from "../review";
import { nextUnreviewed, reviewProgress } from "../review";
import { deriveSegment } from "@/lib/graph/derive";
import { InventoryRow } from "@/widgets/inventory-row";
import { ScrollList } from "@/widgets/scroll-list";
import { Stat } from "@/widgets/stat";
import type { Candidate } from "../candidate-finder";
import { CandidateList } from "./candidate-list";

export type Mode = "nodes" | "segments";

type AdminSidebarProps = {
  mode: Mode;
  onMode: (mode: Mode) => void;
  trackCount: number;
  nodes: GraphNode[];
  segments: SegmentRecord[];
  pins: Pin[];
  geometry: Map<string, ElevCoord[]>;
  from: GraphNode | null;
  to: GraphNode | null;
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  selectedSegments: string[];
  onSelectSegments: (ids: string[]) => void;
  onPatchSelected: (patch: AttributePatch) => void;
  onSwapSelected: () => void;
  onNextUnreviewed: () => void;
  onStepSegment: (delta: 1 | -1) => void;
  candidates: Candidate[] | null;
  radiusMeters: number;
  maxDetourRatio: number;
  onRadius: (value: number) => void;
  onDetour: (value: number) => void;
  hint: string | null;
  error: string | null;
  saving: boolean;
  onHoverGeometry: (points: ElevCoord[] | null) => void;
  onChoose: (candidate: Candidate) => void;
  onClearSelection: () => void;
  onRemoveSegment: (id: string) => void;
  onRenameSegment: (id: string, name: string) => void;
  onRemoveNode: (id: string) => void;
  onRenameNode: (id: string, name: string) => void;
  onLocateNode: (node: GraphNode) => void;
  onLocateSegment: (id: string) => void;
  /** Changes whenever the map is sent somewhere, so the sheet can get out of the way. */
  focusedAt: unknown;
  /** The junction a merge will fold the next click into, if one is armed. */
  merging: GraphNode | null;
  onArmMerge: (node: GraphNode | null) => void;
  selectedPin: Pin | null;
  onSelectPin: (id: string | null) => void;
  dropping: PinKind | null;
  onDropping: (kind: PinKind | null) => void;
  onPinKind: (kind: PinKind) => void;
  onPinNote: (note: string) => void;
  onRemovePin: () => void;
  onLocatePin: (pin: Pin) => void;
};

export function AdminSidebar(props: AdminSidebarProps) {
  const totalMeters = [...props.geometry.values()].reduce(
    (sum, points) => sum + polylineMeters(points),
    0,
  );

  const picked = new Set(props.selectedSegments);
  const chosen = props.segments.filter((segment) => picked.has(segment.id));
  const progress = reviewProgress(props.segments);
  // Only meaningful for a single selection; the editor hides it otherwise.
  const derived = deriveSegment(
    (chosen.length === 1 && props.geometry.get(chosen[0].id)) || [],
  );

  return (
    <Sheet
      raisedWhen={props.candidates !== null}
      lowerOn={props.focusedAt}
      header={
        <div className="flex items-center gap-3">
          <SeaddleMark className="text-sand h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sand text-base leading-none tracking-[0.18em] uppercase">
              Seaddle
            </h1>
            <p className="eyebrow text-sand/70 mt-1">Route builder</p>
          </div>
          <SaveState saving={props.saving} />
        </div>
      }
      peek={
        <div className="flex flex-col gap-4">
          <div className="border-sand/10 flex items-end justify-between border-t pt-3">
            <Stat value={props.trackCount} label="rides" />
            <Stat value={props.nodes.length} label="junctions" />
            <Stat value={props.segments.length} label="segments" />
            <Stat value={formatMiles(totalMeters)} label="mapped" />
          </div>

          {/* Pinned with the counts rather than scrolling with the lists: it
              decides what everything below it means, so it has to be reachable
              without scrolling back up for it. */}
          <Segmented
            options={[
              { value: "nodes" as const, label: "Junctions" },
              { value: "segments" as const, label: "Segments" },
            ]}
            value={props.mode}
            onChange={props.onMode}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {props.error && <Banner tone="alarm">{props.error}</Banner>}
        {props.hint && <Banner tone="notice">{props.hint}</Banner>}

        {chosen.length > 0 && (
          <SegmentEditor
            selected={chosen}
            meters={derived.meters}
            gainForward={derived.gainForward}
            gainBackward={derived.gainBackward}
            reviewed={progress.reviewed}
            total={progress.total}
            onPatch={props.onPatchSelected}
            onRename={(name) =>
              chosen[0] && props.onRenameSegment(chosen[0].id, name)
            }
            onSwap={props.onSwapSelected}
            onNext={props.onNextUnreviewed}
            onStep={props.onStepSegment}
            hasNext={nextUnreviewed(props.segments, null) !== null}
          />
        )}

        {props.mode === "nodes" ? (
          <>
            <p className="text-sand/75 text-sm leading-relaxed">
              Click where rides cross. The click snaps onto the nearest ride,
              and onto a junction already there if one is close — so clicking
              the same intersection twice gives you one junction, not two that
              never connect. Click a junction again to select it.
            </p>
            {props.selectedNode && (
              <div className="border-sand/15 bg-forest-deep/30 flex items-center gap-2 rounded-lg border p-2.5">
                <span className="tabular text-blaze text-xs">
                  {props.selectedNode.id}
                </span>
                <span className="text-sand/70 flex-1 text-[0.6875rem]">
                  {props.merging
                    ? "Now click the junction to fold into it."
                    : "Selected"}
                </span>
                <Button
                  variant={props.merging ? "primary" : "outline"}
                  className="min-h-0 px-2 py-1 text-xs"
                  onClick={() =>
                    props.onArmMerge(props.merging ? null : props.selectedNode)
                  }
                  title="Join two junctions that should have been one"
                >
                  {props.merging ? "Cancel" : "Merge"}
                </Button>
              </div>
            )}

            <JunctionInventory
              nodes={props.nodes}
              segments={props.segments}
              selectedId={props.selectedNode?.id ?? null}
              onSelect={props.onSelectNode}
              onRename={props.onRenameNode}
              onRemove={props.onRemoveNode}
              onLocate={props.onLocateNode}
            />
          </>
        ) : (
          <SegmentBuilder {...props} />
        )}

        <CollapsibleSection title="Pins" count={props.pins.length}>
          <PinEditor
            pins={props.pins}
            selected={props.selectedPin}
            onSelect={props.onSelectPin}
            onKind={props.onPinKind}
            onNote={props.onPinNote}
            onRemove={props.onRemovePin}
            onLocate={props.onLocatePin}
            dropping={props.dropping}
            onDropping={props.onDropping}
          />
        </CollapsibleSection>

        <SegmentInventory
          segments={props.segments}
          selectedIds={props.selectedSegments}
          onSelect={props.onSelectSegments}
          geometry={props.geometry}
          onHover={props.onHoverGeometry}
          onRemove={props.onRemoveSegment}
          onRename={props.onRenameSegment}
          onLocate={props.onLocateSegment}
        />
      </div>
    </Sheet>
  );
}

function SegmentBuilder({
  from,
  to,
  candidates,
  radiusMeters,
  maxDetourRatio,
  onRadius,
  onDetour,
  onHoverGeometry,
  onChoose,
  onClearSelection,
}: AdminSidebarProps) {
  return (
    <section className="flex flex-col gap-4">
      {from && (
        <div className="-mt-2 flex items-center gap-2">
          {/* A fact, not a tutorial: which junctions are picked so far. */}
          <span className="tabular text-blaze/80 flex-1 text-xs">
            {from.id} → {to?.id ?? "…"}
          </span>
          <Button
            variant="quiet"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={onClearSelection}
          >
            Start over
          </Button>
        </div>
      )}

      {candidates && (
        <CandidateList
          candidates={candidates}
          onHover={(candidate) => onHoverGeometry(candidate?.points ?? null)}
          onChoose={onChoose}
        />
      )}

      <details className="group">
        <summary className="eyebrow text-sand/70 hover:text-sand/70 cursor-pointer list-none transition-colors">
          Search settings
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <Range
            label="Search radius"
            value={`${radiusMeters} m`}
            min={10}
            max={100}
            step={1}
            current={radiusMeters}
            onChange={onRadius}
          />
          <Range
            label="Max detour"
            value={`×${maxDetourRatio.toFixed(1)}`}
            min={1}
            max={8}
            step={0.5}
            current={maxDetourRatio}
            onChange={onDetour}
          />
        </div>
      </details>
    </section>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-sand/70 text-sm">{label}</span>
        <span className="tabular text-sand text-xs">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-blaze h-1 w-full cursor-pointer"
      />
    </label>
  );
}

/** Match on the label people give things, and on the id printed beside it. */
function matches(query: string, id: string, name: string | null): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    id.toLowerCase().includes(needle) ||
    (name ?? "").toLowerCase().includes(needle)
  );
}

function SegmentInventory({
  segments,
  selectedIds,
  onSelect,
  geometry,
  onHover,
  onRemove,
  onRename,
  onLocate,
}: {
  segments: SegmentRecord[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  geometry: Map<string, ElevCoord[]>;
  onHover: (points: ElevCoord[] | null) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onLocate: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () => segments.filter((s) => matches(query, s.id, s.name)),
    [segments, query],
  );

  if (segments.length === 0) return null;

  return (
    <CollapsibleSection
      title="Mapped segments"
      count={segments.length}
      openOn={selectedIds.join(",")}
      search={{
        value: query,
        onChange: setQuery,
        label: "Search segments",
      }}
    >
      {shown.length === 0 && <NoMatches query={query} />}
      <ScrollList count={shown.length}>
        {shown.map((segment) => (
          <InventoryRow
            key={segment.id}
            id={segment.id}
            name={segment.name}
            selected={selectedIds.includes(segment.id)}
            revealOnSelect={selectedIds.length === 1}
            onSelect={() =>
              onSelect(
                selectedIds.includes(segment.id)
                  ? selectedIds.filter((id) => id !== segment.id)
                  : [...selectedIds, segment.id],
              )
            }
            detail={formatMiles(polylineMeters(geometry.get(segment.id) ?? []))}
            onRename={(name) => onRename(segment.id, name)}
            onRemove={() => onRemove(segment.id)}
            onLocate={() => onLocate(segment.id)}
            onHover={(hovering) =>
              onHover(hovering ? (geometry.get(segment.id) ?? null) : null)
            }
          />
        ))}
      </ScrollList>
    </CollapsibleSection>
  );
}

function JunctionInventory({
  nodes,
  segments,
  selectedId,
  onSelect,
  onRename,
  onRemove,
  onLocate,
}: {
  nodes: GraphNode[];
  segments: SegmentRecord[];
  selectedId: string | null;
  onSelect: (node: GraphNode | null) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onLocate: (node: GraphNode) => void;
}) {
  const [query, setQuery] = useState("");

  // How many segments hang off each junction. A zero is a junction that can be
  // deleted freely; anything else has to have its segments removed first.
  const load = useMemo(() => {
    const counts = new Map<string, number>();
    for (const segment of segments) {
      for (const end of [segment.from, segment.to]) {
        counts.set(end, (counts.get(end) ?? 0) + 1);
      }
    }
    return counts;
  }, [segments]);

  const shown = useMemo(
    () => nodes.filter((node) => matches(query, node.id, node.name)),
    [nodes, query],
  );

  if (nodes.length === 0) return null;

  return (
    <CollapsibleSection
      title="Placed junctions"
      count={nodes.length}
      openOn={selectedId}
      search={{
        value: query,
        onChange: setQuery,
        label: "Search junctions",
      }}
    >
      {shown.length === 0 && <NoMatches query={query} />}
      <ScrollList count={shown.length}>
        {shown.map((node) => (
          <InventoryRow
            key={node.id}
            id={node.id}
            name={node.name}
            detail={load.get(node.id) ? `${load.get(node.id)} seg` : "unused"}
            selected={node.id === selectedId}
            revealOnSelect
            focusNameOnSelect
            onSelect={() => onSelect(node.id === selectedId ? null : node)}
            onRename={(name) => onRename(node.id, name)}
            onRemove={() => onRemove(node.id)}
            onLocate={() => onLocate(node)}
          />
        ))}
      </ScrollList>
    </CollapsibleSection>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <p className="text-sand/70 px-1 py-2 text-xs">
      Nothing matching “{query.trim()}”.
    </p>
  );
}

function SaveState({ saving }: { saving: boolean }) {
  return (
    <span
      className={cn(
        "eyebrow shrink-0 transition-opacity duration-300",
        saving ? "text-blaze opacity-100" : "opacity-0",
      )}
    >
      Saving
    </span>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "notice" | "alarm";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "rise rounded-lg border px-3 py-2 text-xs leading-relaxed",
        tone === "notice"
          ? "border-blaze/40 bg-blaze/10 text-blaze"
          : "border-red-400/40 bg-red-400/10 text-red-200",
      )}
    >
      {children}
    </p>
  );
}
