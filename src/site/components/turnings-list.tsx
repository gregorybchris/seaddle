import type { SegmentId } from "@/lib/models/graph";
import { cn } from "@/lib/utilities/style-utils";
import { useUnits } from "@/lib/use-units";
import { humanize } from "@/lib/utilities/words";
import type { Turning } from "../turnings";

/**
 * The segments on offer, as a list you can reach with a keyboard.
 *
 * The map is where this decision is normally made, and it is a canvas: a
 * segment drawn on it is not a thing that can be tabbed to, focused, or read
 * aloud, so on the map alone a rider who does not use a mouse cannot build a
 * route at all. This is the junction in front of them, described in the words
 * someone would use standing at one, and picking a row is the same act as
 * clicking that segment on the map. The map will take a pick from anywhere and
 * fill in the way there; a list cannot, because a hundred and seventy rows is the
 * map again in a worse form.
 *
 * Focusing a row lights the segment up on the map, which is what keeps the two
 * halves of the interface talking to each other: the list says which way,
 * the map says where.
 */
export function TurningsList({
  turnings,
  started,
  onPick,
  onHighlight,
}: {
  turnings: Turning[];
  started: boolean;
  onPick: (id: SegmentId) => void;
  onHighlight: (id: SegmentId | null) => void;
}) {
  if (turnings.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-sand/70">
        {started
          ? "Where you can go next"
          : "Segments near the middle of the map"}
      </h2>
      {!started && (
        <p className="text-sand/70 text-xs leading-relaxed">
          Move the map to your neighborhood to change this list.
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {turnings.map((turning) => (
          <li key={turning.segment.id}>
            <Row turning={turning} onPick={onPick} onHighlight={onHighlight} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({
  turning,
  onPick,
  onHighlight,
}: {
  turning: Turning;
  onPick: (id: SegmentId) => void;
  onHighlight: (id: SegmentId | null) => void;
}) {
  const { segment, heading, climbMeters } = turning;
  const { distance, climb } = useUnits();
  // The three scales say nothing about a stretch nobody rides, so a crossing
  // says what it is instead of claiming to be flat and unprotected.
  const character = segment.crossing
    ? `${humanize(segment.crossing)}, not ridden`
    : [segment.steepness, segment.protection, segment.surroundings]
        .map(humanize)
        .join(", ");

  // The compass point is already the words it should be read as: running it
  // through `humanize` turns "south-west" into "south west", which is two
  // directions rather than one.
  const lead = heading ?? segment.name ?? "Unnamed segment";
  const under = heading ? segment.name : null;

  return (
    <button
      type="button"
      // The visible text is split over two lines and leans on an arrow for
      // "climbing", which reads as punctuation rather than as a word. Spelling
      // the whole row out once means it is heard the way it is meant.
      aria-label={[
        lead,
        under,
        distance(segment.meters),
        `${climb(climbMeters)} of climbing`,
        character,
      ]
        .filter(Boolean)
        .join(", ")}
      onClick={() => onPick(segment.id)}
      onFocus={() => onHighlight(segment.id)}
      onBlur={() => onHighlight(null)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHighlight(segment.id);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onHighlight(null);
      }}
      className={cn(
        "flex min-h-11 w-full flex-col justify-center gap-0.5 rounded-lg border",
        "px-2.5 py-1.5 text-left transition-colors",
        "border-sand/15 bg-forest-lift/20",
        "hover:border-sand/40 hover:bg-forest-lift/50",
        "focus-visible:ring-blaze focus-visible:border-blaze/60",
        "focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sand min-w-0 truncate text-sm">{lead}</span>
        <span
          aria-hidden
          className="tabular text-sand/70 shrink-0 text-[0.6875rem]"
        >
          {distance(segment.meters)} ·{" "}
          <span className="text-sand mr-0.5">&uarr;</span>
          {climb(climbMeters)}
        </span>
      </span>
      <span
        aria-hidden
        className="text-sand/70 truncate text-[0.6875rem] leading-tight"
      >
        {under ? `${under} · ${character}` : character}
      </span>
    </button>
  );
}
