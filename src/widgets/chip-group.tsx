import { Fragment } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { humanize } from "@/lib/utilities/words";

type ChipGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  /** Shown when the values disagree across a multiple selection. */
  mixed?: boolean;
  /**
   * Draw the options as one joined bar rather than as separate chips.
   *
   * For a scale — flat, rolling, steep — where the options are ordered, few and
   * short. Sharing an edge says they are one question with one answer, which is
   * true of a scale and is the thing a row of separate chips leaves the reader
   * to work out. A set that is unordered, or long enough to wrap, stays as
   * chips: a joined row that wraps has to round a corner mid-scale, and stops
   * reading as one control the moment it does.
   */
  joined?: boolean;
};

/**
 * A row of one-word choices.
 *
 * Every attribute here has three or four possible answers and gets picked
 * hundreds of times, so they are all on screen at once: a dropdown would turn
 * one decision into two clicks and hide the range of answers while choosing.
 */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  mixed = false,
  joined = false,
}: ChipGroupProps<T>) {
  const heading = (
    <span className="eyebrow text-sand/70">
      {label}
      {mixed && <span className="text-blaze/70 ml-2 normal-case">mixed</span>}
    </span>
  );

  if (joined) {
    return (
      <div className="flex flex-col gap-1.5">
        {heading}
        <div role="radiogroup" aria-label={label} className="flex">
          {options.map((option, index) => {
            const active = !mixed && option === value;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(option)}
                className={cn(
                  "focus-visible:ring-blaze relative min-h-11 flex-1 border px-2 text-xs transition-colors focus-visible:z-20 focus-visible:ring-2 focus-visible:outline-none",
                  // Only the ends of the bar are round. A corner anywhere else
                  // would cut the row into pieces, which is the reading this
                  // shape exists to avoid.
                  index === 0 && "rounded-l-md",
                  index === options.length - 1 && "rounded-r-md",
                  // Each option sits on its neighbour's edge, so the line
                  // between two of them is one border rather than two.
                  index > 0 && "-ml-px",
                  active
                    ? // Lifted, because the shared edge belongs to whichever
                      // side is answering — otherwise the neighbour's grey
                      // draws over half of the answer's outline.
                      "border-blaze-deep bg-blaze text-forest-deep z-10"
                    : "border-sand/15 text-sand/70 hover:border-sand/40 hover:text-sand hover:z-10",
                )}
              >
                {humanize(option)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {heading}
      {/* Balanced rather than flex-wrapped. Wrapping fills each line before
          starting the next, which with five choices leaves one chip sitting
          alone on a second line looking like it belongs to something else;
          balancing spreads them evenly instead. It only works on lines of
          inline content, so these are inline-blocks separated by real spaces
          rather than flex items — and where a browser does not support it they
          wrap exactly as they did before. */}
      <div
        role="radiogroup"
        aria-label={label}
        className="-mx-0.5 -mb-1 text-balance"
      >
        {options.map((option) => {
          const active = !mixed && option === value;
          return (
            <Fragment key={option}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(option)}
                className={cn(
                  // Inline-flex rather than inline-block: still inline-level,
                  // so the balancing above still sees a line of words, but the
                  // label centres in a box tall enough for a fingertip.
                  "focus-visible:ring-blaze mx-0.5 mb-1 inline-flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-blaze-deep bg-blaze text-forest-deep"
                    : "border-sand/15 text-sand/70 hover:border-sand/40 hover:text-sand",
                )}
              >
                {humanize(option)}
              </button>{" "}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
