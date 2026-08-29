import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  CheckCircle,
  SkipForward,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
  PROTECTIONS,
  SURROUNDINGS,
  STEEPNESSES,
  type Steepness,
  type SegmentRecord,
} from "@/lib/models/graph";
import { cn } from "@/lib/utilities/style-utils";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { ChipGroup } from "@/widgets/chip-group";
import type { AttributePatch } from "../review";

type SegmentEditorProps = {
  selected: SegmentRecord[];
  meters: number;
  gainForward: number;
  gainBackward: number;
  reviewed: number;
  total: number;
  onPatch: (patch: AttributePatch) => void;
  onRename: (name: string) => void;
  onSwap: () => void;
  onNext: () => void;
  hasNext: boolean;
  /** Walk to the segment before or after this one, in id order. */
  onStep: (delta: 1 | -1) => void;
};

/**
 * Judging a segment: how hard, how safe, how pretty, what it is made of.
 *
 * Built for the pass rather than the single edit — a hundred and forty-five of
 * these have to be decided, so the panel keeps the count in view and hands over
 * the next unjudged segment when one is finished.
 */
export function SegmentEditor({
  selected,
  meters,
  gainForward,
  gainBackward,
  reviewed,
  total,
  onPatch,
  onRename,
  onSwap,
  onNext,
  hasNext,
  onStep,
}: SegmentEditorProps) {
  if (selected.length === 0) return null;

  const one = selected.length === 1 ? selected[0] : null;
  const shared = <T,>(read: (segment: SegmentRecord) => T): T | null => {
    const first = read(selected[0]);
    return selected.every((segment) => read(segment) === first) ? first : null;
  };
  const disagree = <T,>(read: (segment: SegmentRecord) => T): boolean =>
    selected.length > 1 && shared(read) === null;

  const allReviewed = selected.every((segment) => segment.reviewed);

  return (
    <section className="border-sand/15 bg-forest-deep/30 flex flex-col gap-4 rounded-lg border p-3">
      <header className="flex items-baseline gap-2">
        <span className="tabular text-blaze text-xs">
          {one ? one.id : `${selected.length} segments`}
        </span>
        <span
          className={cn(
            "eyebrow ml-auto shrink-0",
            allReviewed ? "text-moss" : "text-sand/70",
          )}
        >
          {allReviewed ? "reviewed" : "defaults"}
        </span>
      </header>

      {one && <NameField key={one.id} name={one.name} onRename={onRename} />}

      {one && (
        <div className="-mt-2 flex items-center gap-2">
          <p className="tabular text-sand/70 flex-1 text-[0.6875rem] whitespace-nowrap">
            {formatMiles(meters)} · ↑{formatFeet(gainForward)} out · ↑
            {formatFeet(gainBackward)} back
          </p>
          <Button
            variant="quiet"
            className="min-h-0 px-2 py-1 text-[0.6875rem]"
            onClick={onSwap}
            title="Turn the segment around, so forward points the other way"
          >
            <ArrowsClockwise weight="bold" className="h-3.5 w-3.5" />
            Swap
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <ChipGroup
          label="Steepness"
          joined
          options={STEEPNESSES}
          value={shared((s) => s.steepness)}
          mixed={disagree((s) => s.steepness)}
          onChange={(steepness: Steepness) => onPatch({ steepness })}
        />
        <ChipGroup
          label="Protection"
          joined
          options={PROTECTIONS}
          value={shared((s) => s.protection)}
          mixed={disagree((s) => s.protection)}
          onChange={(protection) => onPatch({ protection })}
        />
        <ChipGroup
          label="Surroundings"
          joined
          options={SURROUNDINGS}
          value={shared((s) => s.surroundings)}
          mixed={disagree((s) => s.surroundings)}
          onChange={(surroundings) => onPatch({ surroundings })}
        />
      </div>

      <div className="border-sand/10 flex items-center gap-2 border-t pt-3">
        <span className="tabular text-sand/70 flex-1 text-[0.6875rem]">
          {reviewed} of {total} reviewed
        </span>
        {/* Stepping walks every segment, so the way back to the one just
            judged is the same button whether or not judging it moved it out
            of the unreviewed queue. Only with a single segment in hand: from
            a multiple selection there is no "this one" to step from. A and D
            do the same, for a pass that keeps its hands on the keys. */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="quiet"
            className="min-h-9 px-1.5"
            onClick={() => onStep(-1)}
            disabled={!one}
            aria-label="Previous segment"
            title="Previous segment (A)"
          >
            <CaretLeft weight="bold" className="h-4 w-4" />
          </Button>
          <Button
            variant="quiet"
            className="min-h-9 px-1.5"
            onClick={() => onStep(1)}
            disabled={!one}
            aria-label="Next segment"
            title="Next segment (D)"
          >
            <CaretRight weight="bold" className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant={allReviewed ? "primary" : "outline"}
          className="min-h-9 px-2 text-xs"
          onClick={onNext}
          disabled={!hasNext}
        >
          {allReviewed ? (
            <CheckCircle weight="bold" className="h-4 w-4" />
          ) : (
            <SkipForward weight="bold" className="h-4 w-4" />
          )}
          Next unreviewed
        </Button>
      </div>
    </section>
  );
}

/**
 * The segment's label, editable where it is read.
 *
 * Same always-live field as the inventory rows use: it reads as text until
 * touched and commits on blur or Enter, rather than a mode to enter and leave
 * for what is only typing.
 */
function NameField({
  name,
  onRename,
}: {
  name: string | null;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name ?? "");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(name ?? ""), [name]);

  return (
    <input
      ref={field}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() !== (name ?? "")) onRename(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(name ?? "");
      }}
      placeholder="Name this segment"
      aria-label="Segment name"
      className="border-sand/15 bg-forest-deep/40 text-sand placeholder:text-sand/70 focus:border-blaze/60 -mt-1 w-full rounded-md border px-2 py-1.5 text-sm transition-colors focus:outline-none"
    />
  );
}
