import { cn } from "@/lib/utilities/style-utils";
import { humanize } from "@/lib/utilities/words";

/**
 * A row of choices any number of which can be on.
 *
 * For sets of unrelated things — the surfaces a rider will ride — where a
 * threshold would be nonsense: wanting asphalt and dirt but not gravel is a
 * perfectly ordinary thing to want.
 */
export function ChipToggles<T extends string>({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: readonly T[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow text-sand/70">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const on = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={option}
              onClick={() =>
                onChange(
                  on
                    ? values.filter((value) => value !== option)
                    : [...values, option],
                )
              }
              className={cn(
                "focus-visible:ring-blaze rounded-md border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                on
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
