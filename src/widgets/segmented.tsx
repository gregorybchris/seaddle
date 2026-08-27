import { cn } from "@/lib/utilities/style-utils";

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * A mode switch where the indicator slides between options.
 *
 * The movement is the point: it says the two modes are the same surface in
 * different states, rather than two buttons that happen to sit together.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const active = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="tablist"
      className={cn(
        "border-forest-deep/60 bg-forest-deep/50 relative flex rounded-lg border p-1",
        className,
      )}
    >
      <div
        className="bg-blaze absolute inset-y-1 rounded-md transition-transform duration-200 ease-[var(--ease-settle)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(calc(${active} * 100%))`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          type="button"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "focus-visible:ring-sand relative flex-1 rounded-md px-3 py-1.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none",
            option.value === value
              ? "text-forest-deep"
              : "text-sand/70 hover:text-sand",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
