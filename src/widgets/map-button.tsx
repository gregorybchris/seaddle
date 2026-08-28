import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utilities/style-utils";

/**
 * A control sitting on the map rather than in a panel.
 *
 * Pale, because the ground under it is: the basemaps are all near-white, and the
 * forest the rest of the site is built from would read as a hole punched in the
 * map. Bordered and shadowed because it floats over something — the same rule
 * the panels follow, which is that whatever is on top of the map says so.
 */
export function MapButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "border-forest-deep bg-paper text-forest-deep grid h-9 w-9 place-items-center rounded-lg border-2",
        "shadow-[2px_2px_0_var(--color-forest-deep)]",
        "transition-[transform,box-shadow,background-color] duration-150 ease-[var(--ease-settle)] motion-reduce:transition-none",
        "hover:bg-sand/40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "focus-visible:ring-forest focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
