import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utilities/style-utils";

/**
 * Filter-as-you-type for a list.
 *
 * Radix has no search primitive, so this is a plain input given the same
 * treatment as the rest of the panel: a real `type="search"`, a label for
 * anyone not looking at it, and a clear button that only exists once there is
 * something to clear.
 */
export function SearchField({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <MagnifyingGlass
        weight="bold"
        aria-hidden
        className="text-sand/30 pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2"
      />
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        className={cn(
          "border-sand/15 bg-forest-deep/40 text-sand placeholder:text-sand/30 w-full rounded-md border py-1.5 pr-7 pl-7 text-xs",
          "focus:border-blaze/60 transition-colors focus:outline-none",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="text-sand/40 hover:text-blaze absolute top-1/2 right-1.5 -translate-y-1/2 p-1 transition-colors"
        >
          <X weight="bold" className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
