import { cn } from "@/lib/utilities/style-utils";
import { humanize } from "@/lib/utilities/words";
import {
  ENCODINGS,
  ENCODING_BLURBS,
  ENCODING_ICONS,
  ENCODING_VALUES,
  gradeRamp,
  isAttribute,
  RAMPS,
  type Encoding,
} from "../encoding";
import { STEEPEST_GRADE } from "../grade";

/**
 * What the map colors segments by, offered as the four maps it makes.
 *
 * A row of chips said the names and nothing else, which left the choice to be
 * made by guessing what "surroundings" would look like and then closing the
 * dialog to find out. So each one carries its own scale instead: the colors a
 * rider is about to be looking at, in the order they run, with the words they
 * stand for underneath. Picking becomes recognising rather than remembering,
 * and the card is the key to the map before the map has changed.
 *
 * Four cards down a column rather than a grid of two. They are read one after
 * another — four answers to "what do you want to know about these segments" —
 * and a column is the shape of a list of answers. Each is wide enough for a
 * ramp whose steps can be told apart, which two columns are not.
 */
export function ColorPanel({
  value,
  onChange,
}: {
  value: Encoding;
  onChange: (encoding: Encoding) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Segment color"
      className="flex flex-col gap-2"
    >
      {ENCODINGS.map((encoding) => (
        <Choice
          key={encoding}
          encoding={encoding}
          chosen={encoding === value}
          onChoose={() => onChange(encoding)}
        />
      ))}
    </div>
  );
}

/**
 * One encoding: its mark, its name, what it answers, and its ramp.
 *
 * Spans all the way down, because a button may only hold phrasing content —
 * a list of swatches inside one would be invalid, and a screen reader given a
 * nested list inside a radio reads the furniture rather than the choice. The
 * value words are inside the button on purpose, so what is announced is
 * "steepness, one word for the whole segment, flat rolling steep".
 */
function Choice({
  encoding,
  chosen,
  onChoose,
}: {
  encoding: Encoding;
  chosen: boolean;
  onChoose: () => void;
}) {
  const Mark = ENCODING_ICONS[encoding];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onChoose}
      className={cn(
        "focus-visible:ring-blaze flex w-full flex-col gap-2.5 rounded-lg border px-3 py-2.5 text-left",
        "transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
        chosen
          ? "border-blaze/60 bg-blaze/10"
          : "border-sand/15 hover:border-sand/40 hover:bg-sand/5",
      )}
    >
      <span className="flex items-start gap-2.5">
        <Mark
          aria-hidden
          weight="bold"
          // Sat on the name's line rather than centred on the pair, so a
          // two-line blurb does not drag the mark down away from what it marks.
          className={cn(
            "mt-px h-4 w-4 shrink-0",
            chosen ? "text-blaze" : "text-sand/45",
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm capitalize",
              chosen ? "text-sand" : "text-sand/85",
            )}
          >
            {humanize(encoding)}
          </span>
          <span className="text-sand/60 mt-0.5 block text-[0.6875rem] leading-snug">
            {ENCODING_BLURBS[encoding]}
          </span>
        </span>
      </span>
      <Ramp encoding={encoding} />
    </button>
  );
}

/**
 * The scale itself, drawn the way the map will draw it.
 *
 * Stepped for an attribute and continuous for grade, which is the one real
 * difference between them — a segment is one steepness end to end, and the
 * ground under it changes the whole way. The swatches keep a ring for the same
 * reason the key on the map does: the dark end of every ramp is tuned against a
 * near-white basemap and would otherwise sink into this dialog's forest.
 */
function Ramp({ encoding }: { encoding: Encoding }) {
  if (!isAttribute(encoding)) {
    return (
      <span className="flex flex-col gap-1">
        <span
          aria-hidden
          className="ring-forest-deep/30 h-2.5 w-full rounded-full ring-1"
          style={{
            backgroundImage: `linear-gradient(to right, ${gradeRamp()})`,
          }}
        />
        <span className="text-sand/60 flex justify-between text-[0.625rem]">
          <span>flat</span>
          <span className="tabular">{STEEPEST_GRADE}%+</span>
        </span>
      </span>
    );
  }

  return (
    <span className="flex gap-1.5">
      {ENCODING_VALUES[encoding].map((step) => (
        <span key={step} className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            aria-hidden
            className="ring-forest-deep/30 h-2.5 w-full rounded-full ring-1"
            style={{ backgroundColor: RAMPS[encoding][step] }}
          />
          <span className="text-sand/60 truncate text-center text-[0.625rem]">
            {humanize(step)}
          </span>
        </span>
      ))}
    </span>
  );
}
