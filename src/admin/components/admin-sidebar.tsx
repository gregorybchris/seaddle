import type { ElevCoord } from "@/lib/models/geo";
import type { GraphNode } from "@/lib/models/graph";
import { polylineMeters } from "@/lib/geo/polyline";
import { cn } from "@/lib/utilities/style-utils";
import { formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { CycattleMark } from "@/widgets/cycattle-mark";
import { Segmented } from "@/widgets/segmented";
import { Sheet } from "@/widgets/sheet";
import { Stat } from "@/widgets/stat";
import type { Candidate } from "../candidate-finder";
import { CandidateList } from "./candidate-list";

export type Mode = "nodes" | "segments";

type AdminSidebarProps = {
  mode: Mode;
  onMode: (mode: Mode) => void;
  trackCount: number;
  nodes: GraphNode[];
  segmentIds: string[];
  geometry: Map<string, ElevCoord[]>;
  from: GraphNode | null;
  to: GraphNode | null;
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
};

export function AdminSidebar(props: AdminSidebarProps) {
  const totalMeters = [...props.geometry.values()].reduce(
    (sum, points) => sum + polylineMeters(points),
    0,
  );

  return (
    <Sheet
      raisedWhen={props.candidates !== null}
      peek={
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <CycattleMark className="text-sand h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-sand text-base leading-none tracking-[0.18em] uppercase">
                Cycattle
              </h1>
              <p className="eyebrow text-sand/40 mt-1">Route builder</p>
            </div>
            <SaveState saving={props.saving} />
          </div>

          <div className="border-sand/10 flex items-end justify-between border-t pt-3">
            <Stat value={props.trackCount} label="rides" />
            <Stat value={props.nodes.length} label="junctions" />
            <Stat value={props.segmentIds.length} label="segments" />
            <Stat value={formatMiles(totalMeters)} label="mapped" />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Segmented
          options={[
            { value: "nodes" as const, label: "Junctions" },
            { value: "segments" as const, label: "Segments" },
          ]}
          value={props.mode}
          onChange={props.onMode}
        />

        {props.error && <Banner tone="alarm">{props.error}</Banner>}
        {props.hint && <Banner tone="notice">{props.hint}</Banner>}

        {props.mode === "nodes" ? (
          <section className="flex flex-col gap-2">
            <p className="text-sand/75 text-sm leading-relaxed">
              Click where rides cross. The click snaps onto the nearest ride,
              and onto a junction already there if one is close — so clicking
              the same intersection twice gives you one junction, not two that
              never connect.
            </p>
          </section>
        ) : (
          <SegmentBuilder {...props} />
        )}

        <Inventory
          ids={props.segmentIds}
          geometry={props.geometry}
          onHover={props.onHoverGeometry}
          onRemove={props.onRemoveSegment}
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
      <Steps
        steps={[
          { label: "Start junction", value: from?.id, done: !!from },
          { label: "End junction", value: to?.id, done: !!to },
          {
            label: "Choose geometry",
            value: candidates ? `${candidates.length} found` : undefined,
            done: false,
          },
        ]}
      />

      {from && (
        <Button
          variant="quiet"
          className="-mt-2 min-h-0 self-end px-2 py-1 text-xs"
          onClick={onClearSelection}
        >
          Start over
        </Button>
      )}

      {candidates && (
        <CandidateList
          candidates={candidates}
          onHover={(candidate) => onHoverGeometry(candidate?.points ?? null)}
          onChoose={onChoose}
        />
      )}

      <details className="group">
        <summary className="eyebrow text-sand/40 hover:text-sand/70 cursor-pointer list-none transition-colors">
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

type Step = { label: string; value?: string; done: boolean };

/**
 * The three moves that make a segment, in order.
 *
 * Numbered because this genuinely is a sequence — you cannot pick geometry
 * before you have said which two junctions it runs between — and the marker
 * carries the state of each move rather than decorating it.
 */
function Steps({ steps }: { steps: Step[] }) {
  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const current = index === currentIndex;
        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] transition-colors duration-200",
                  step.done && "border-moss bg-moss text-forest-deep",
                  current && "border-blaze text-blaze",
                  !step.done && !current && "border-sand/20 text-sand/30",
                )}
              >
                {step.done ? "✓" : index + 1}
              </span>
              {index < steps.length - 1 && (
                <span
                  className={cn(
                    "w-px flex-1 transition-colors duration-200",
                    step.done ? "bg-moss/50" : "bg-sand/15",
                  )}
                />
              )}
            </div>
            <div className={cn("pb-4", index === steps.length - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm leading-6 transition-colors duration-200",
                  current
                    ? "text-sand"
                    : step.done
                      ? "text-sand/70"
                      : "text-sand/35",
                )}
              >
                {step.label}
              </p>
              {step.value && (
                <p className="tabular text-blaze/90 text-xs">{step.value}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
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

function Inventory({
  ids,
  geometry,
  onHover,
  onRemove,
}: {
  ids: string[];
  geometry: Map<string, ElevCoord[]>;
  onHover: (points: ElevCoord[] | null) => void;
  onRemove: (id: string) => void;
}) {
  if (ids.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-sand/40">Mapped segments</h2>
      <ul className="flex flex-col">
        {ids.map((id) => (
          <li
            key={id}
            onMouseEnter={() => onHover(geometry.get(id) ?? null)}
            onMouseLeave={() => onHover(null)}
            className="border-sand/10 hover:bg-sand/5 group flex items-center gap-3 border-b px-1 py-2 transition-colors last:border-b-0"
          >
            <span className="tabular text-sand/80 text-xs">{id}</span>
            <span className="tabular text-sand/45 flex-1 text-xs">
              {formatMiles(polylineMeters(geometry.get(id) ?? []))}
            </span>
            <button
              type="button"
              onClick={() => onRemove(id)}
              className="text-sand/0 hover:text-blaze focus-visible:text-blaze group-hover:text-sand/50 text-xs transition-colors focus-visible:outline-none"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
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
