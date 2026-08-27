import { CheckCircle, SkipForward } from "@phosphor-icons/react";
import {
  DIFFICULTIES,
  LANE_QUALITIES,
  SCENICS,
  SURFACES,
  type Difficulty,
  type Direction,
  type SegmentRecord,
} from "@/lib/models/graph";
import { cn } from "@/lib/utilities/style-utils";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { ChipGroup } from "@/widgets/chip-group";
import type { AttributePatch } from "../review";

const DIRECTIONS = ["forward", "backward", "either"] as const;

type SegmentEditorProps = {
  selected: SegmentRecord[];
  meters: number;
  gainForward: number;
  gainBackward: number;
  reviewed: number;
  total: number;
  onPatch: (patch: AttributePatch) => void;
  onNext: () => void;
  hasNext: boolean;
};

/**
 * Judging a road: how hard, how safe, how pretty, what it is made of.
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
  onNext,
  hasNext,
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
        {one && (
          <span className="text-sand truncate text-sm">
            {one.name ?? "unnamed"}
          </span>
        )}
        <span
          className={cn(
            "eyebrow ml-auto shrink-0",
            allReviewed ? "text-moss" : "text-sand/30",
          )}
        >
          {allReviewed ? "reviewed" : "defaults"}
        </span>
      </header>

      {one && (
        <p className="tabular text-sand/45 -mt-2 text-[0.6875rem]">
          {formatMiles(meters)} · ↑{formatFeet(gainForward)} out · ↑
          {formatFeet(gainBackward)} back
        </p>
      )}

      <div className="flex flex-col gap-3">
        <ChipGroup
          label="Difficulty out"
          options={DIFFICULTIES}
          value={shared((s) => s.difficulty.forward)}
          mixed={disagree((s) => s.difficulty.forward)}
          onChange={(value: Difficulty) =>
            onPatch({ difficultyForward: value })
          }
        />
        <ChipGroup
          label="Difficulty back"
          options={DIFFICULTIES}
          value={shared((s) => s.difficulty.backward)}
          mixed={disagree((s) => s.difficulty.backward)}
          onChange={(value: Difficulty) =>
            onPatch({ difficultyBackward: value })
          }
        />
        <ChipGroup
          label="Bike lane"
          options={LANE_QUALITIES}
          value={shared((s) => s.laneQuality)}
          mixed={disagree((s) => s.laneQuality)}
          onChange={(laneQuality) => onPatch({ laneQuality })}
        />
        <ChipGroup
          label="Scenic"
          options={SCENICS}
          value={shared((s) => s.scenic)}
          mixed={disagree((s) => s.scenic)}
          onChange={(scenic) => onPatch({ scenic })}
        />
        <ChipGroup
          label="Surface"
          options={SURFACES}
          value={shared((s) => s.surface)}
          mixed={disagree((s) => s.surface)}
          onChange={(surface) => onPatch({ surface })}
        />
        <ChipGroup
          label="Ride it"
          options={DIRECTIONS}
          value={shared((s) => s.recommendedDirection ?? "either")}
          mixed={disagree((s) => s.recommendedDirection)}
          onChange={(choice) =>
            onPatch({
              recommendedDirection:
                choice === "either" ? null : (choice as Direction),
            })
          }
        />
      </div>

      <div className="border-sand/10 flex items-center gap-2 border-t pt-3">
        <span className="tabular text-sand/40 flex-1 text-[0.6875rem]">
          {reviewed} of {total} reviewed
        </span>
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
