import { cn } from "@/lib/utilities/style-utils";
import { humanize } from "@/lib/utilities/words";

type ChipGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  /** Shown when the values disagree across a multiple selection. */
  mixed?: boolean;
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
}: ChipGroupProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow text-sand/70">
        {label}
        {mixed && <span className="text-blaze/70 ml-2 normal-case">mixed</span>}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1"
      >
        {options.map((option) => {
          const active = !mixed && option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option)}
              className={cn(
                "focus-visible:ring-blaze rounded-md border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-blaze-deep bg-blaze text-forest-deep"
                  : "border-sand/15 text-sand/70 hover:border-sand/40 hover:text-sand",
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
